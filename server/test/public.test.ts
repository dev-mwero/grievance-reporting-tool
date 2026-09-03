import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './setup';
import { seedLookupData } from './helpers';

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
        .send({
          subCountyId,
          wardId,
          categoryId,
          description: 'The main road has a large pothole that needs urgent repair.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.referenceCode).toMatch(/^GRV-\d{4}-[A-F0-9]{8}$/);
      expect(res.body.data.status).toBe('SUBMITTED');
    });

    it('rejects a description that is too short', async () => {
      const res = await request(app)
        .post('/api/public/grievances')
        .send({
          subCountyId,
          wardId,
          categoryId,
          description: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing required fields', async () => {
      const res = await request(app)
        .post('/api/public/grievances')
        .send({ description: 'A valid description that is long enough.' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/public/grievances/:referenceCode', () => {
    it('tracks a grievance by reference code', async () => {
      // Submit a grievance first
      const submitRes = await request(app)
        .post('/api/public/grievances')
        .send({
          subCountyId,
          wardId,
          categoryId,
          description: 'Street lights are not working on the main avenue.',
        });
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
