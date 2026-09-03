import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './setup';
import { seedLookupData } from './helpers';
import { Grievance } from '../src/models/grievance.model';
import { Attachment } from '../src/models/attachment.model';

describe('Public Grievance API', () => {
  let categoryId: string;
  let subCountyId: string;
  let wardId: string;

  beforeEach(async () => {
    const { category, subCounty, ward } = await seedLookupData();
    categoryId = category._id.toString();
    subCountyId = subCounty._id.toString();
    wardId = ward._id.toString();
  });

  describe('GET /api/public/categories', () => {
    it('returns active categories', async () => {
      const res = await request(app).get('/api/public/categories');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].name).toBe('Infrastructure');
    });
  });

  describe('GET /api/public/sub-counties', () => {
    it('returns active sub-counties', async () => {
      const res = await request(app).get('/api/public/sub-counties');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].name).toBe('Central');
    });
  });

  describe('GET /api/public/wards', () => {
    it('returns wards for a sub-county', async () => {
      const res = await request(app)
        .get('/api/public/wards')
        .query({ subCountyId });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].name).toBe('Downtown');
    });

    it('rejects missing subCountyId', async () => {
      const res = await request(app).get('/api/public/wards');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/public/grievances', () => {
    it('submits a grievance and returns a reference code', async () => {
      const res = await request(app)
        .post('/api/public/grievances')
        .field('subCountyId', subCountyId)
        .field('wardId', wardId)
        .field('categoryId', categoryId)
        .field('description', 'The main road has a large pothole that needs urgent repair.');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.referenceCode).toMatch(/^GRV-\d{4}-[A-F0-9]{8}$/);
      expect(res.body.data.status).toBe('SUBMITTED');
    });

    it('rejects a description that is too short', async () => {
      const res = await request(app)
        .post('/api/public/grievances')
        .field('subCountyId', subCountyId)
        .field('wardId', wardId)
        .field('categoryId', categoryId)
        .field('description', 'short');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing required fields', async () => {
      const res = await request(app)
        .post('/api/public/grievances')
        .field('description', 'A valid description that is long enough.');

      expect(res.status).toBe(400);
    });

    it('accepts rich text description and sanitizes dangerous HTML', async () => {
      const res = await request(app)
        .post('/api/public/grievances')
        .field('subCountyId', subCountyId)
        .field('wardId', wardId)
        .field('categoryId', categoryId)
        .field(
          'description',
          '<p>The road has a <strong>large pothole</strong> near the market.</p><ul><li>Item one</li><li>Item two</li></ul><script>alert("xss")</script>'
        );

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify the stored description is sanitized (script tag removed)
      const grievance = await Grievance.findOne({ referenceCode: res.body.data.referenceCode });
      expect(grievance).toBeDefined();
      expect(grievance!.description).toContain('<strong>large pothole</strong>');
      expect(grievance!.description).toContain('<ul>');
      expect(grievance!.description).not.toContain('<script>');
    });

    it('accepts up to 5 file attachments', async () => {
      const res = await request(app)
        .post('/api/public/grievances')
        .field('subCountyId', subCountyId)
        .field('wardId', wardId)
        .field('categoryId', categoryId)
        .field('description', 'A grievance with multiple file attachments for testing purposes.')
        .attach('files', Buffer.from('test file content 1'), {
          filename: 'evidence1.txt',
          contentType: 'text/plain',
        })
        .attach('files', Buffer.from('test file content 2'), {
          filename: 'evidence2.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.attachmentCount).toBe(2);

      // Verify attachments were created
      const grievance = await Grievance.findOne({ referenceCode: res.body.data.referenceCode });
      expect(grievance).toBeDefined();
      const attachments = await Attachment.find({ grievanceId: grievance!._id }).sort({ uploadedAt: 1 });
      expect(attachments.length).toBe(2);
      expect(attachments[0].originalName).toBe('evidence1.txt');
      expect(attachments[0].uploadedBy).toBeUndefined(); // anonymous upload
    });

    it('rejects unsupported file types', async () => {
      const res = await request(app)
        .post('/api/public/grievances')
        .field('subCountyId', subCountyId)
        .field('wardId', wardId)
        .field('categoryId', categoryId)
        .field('description', 'A grievance with an unsupported file type for testing.')
        .attach('files', Buffer.from('not an image'), {
          filename: 'malware.exe',
          contentType: 'application/x-msdownload',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects more than 5 files', async () => {
      const res = await request(app)
        .post('/api/public/grievances')
        .field('subCountyId', subCountyId)
        .field('wardId', wardId)
        .field('categoryId', categoryId)
        .field('description', 'A grievance with too many file attachments for testing.')
        .attach('files', Buffer.from('file 1'), { filename: 'f1.txt', contentType: 'text/plain' })
        .attach('files', Buffer.from('file 2'), { filename: 'f2.txt', contentType: 'text/plain' })
        .attach('files', Buffer.from('file 3'), { filename: 'f3.txt', contentType: 'text/plain' })
        .attach('files', Buffer.from('file 4'), { filename: 'f4.txt', contentType: 'text/plain' })
        .attach('files', Buffer.from('file 5'), { filename: 'f5.txt', contentType: 'text/plain' })
        .attach('files', Buffer.from('file 6'), { filename: 'f6.txt', contentType: 'text/plain' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/public/grievances/:referenceCode', () => {
    it('tracks a grievance by reference code', async () => {
      // Submit a grievance first
      const submitRes = await request(app)
        .post('/api/public/grievances')
        .field('subCountyId', subCountyId)
        .field('wardId', wardId)
        .field('categoryId', categoryId)
        .field('description', 'Street lights are not working on the main avenue.');
      const referenceCode = submitRes.body.data.referenceCode;

      const res = await request(app).get(`/api/public/grievances/${referenceCode}`);
      expect(res.status).toBe(200);
      expect(res.body.data.referenceCode).toBe(referenceCode);
      expect(res.body.data.status).toBe('SUBMITTED');
      // Public tracking should not expose internal data
      expect(res.body.data.primaryAssigneeId).toBeUndefined();
    });

    it('returns 404 for an unknown reference code', async () => {
      const res = await request(app).get('/api/public/grievances/GRV-2026-00000000');
      expect(res.status).toBe(404);
    });

    it('rejects an invalid reference code format', async () => {
      const res = await request(app).get('/api/public/grievances/INVALID');
      expect(res.status).toBe(400);
    });
  });
});
