import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Role, GrievanceStatus } from 'shared';
import { app } from './setup';
import { createUser, createAdmin, loginAndGetToken, seedLookupData } from './helpers';
import { Grievance } from '../src/models/grievance.model';

describe('Grievance Management API', () => {
  let admin: Awaited<ReturnType<typeof createAdmin>>;
  let staff: Awaited<ReturnType<typeof createUser>>;
  let adminToken: string;
  let staffToken: string;
  let categoryId: string;
  let subCountyId: string;
  let wardId: string;

  beforeEach(async () => {
    admin = await createAdmin();
    staff = await createUser({ email: 'staff-grievance@test.com' });
    adminToken = await loginAndGetToken(admin);
    staffToken = await loginAndGetToken(staff);

    const { category, subCounty, ward } = await seedLookupData();
    categoryId = category._id.toString();
    subCountyId = subCounty._id.toString();
    wardId = ward._id.toString();
  });

  async function createGrievance(status: GrievanceStatus = GrievanceStatus.SUBMITTED) {
    return Grievance.create({
      subCountyId,
      wardId,
      categoryId,
      subCountyName: 'Central',
      wardName: 'Downtown',
      categoryName: 'Infrastructure',
      description: 'A test grievance with a sufficiently long description.',
      status,
    });
  }

  describe('GET /api/grievances', () => {
    it('lists grievances for an authenticated user', async () => {
      await createGrievance();

      const res = await request(app)
        .get('/api/grievances')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.pagination).toBeDefined();
    });

    it('filters by status', async () => {
      await createGrievance(GrievanceStatus.SUBMITTED);
      await createGrievance(GrievanceStatus.RESOLVED);

      const res = await request(app)
        .get('/api/grievances')
        .query({ status: GrievanceStatus.RESOLVED })
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe(GrievanceStatus.RESOLVED);
    });

    it('requires authentication', async () => {
      const res = await request(app).get('/api/grievances');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/grievances/:id', () => {
    it('returns grievance details', async () => {
      const grievance = await createGrievance();

      const res = await request(app)
        .get(`/api/grievances/${grievance._id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.grievance.referenceCode).toBe(grievance.referenceCode);
      expect(res.body.data.grievance.status).toBe(GrievanceStatus.SUBMITTED);
      expect(res.body.data.updates).toBeDefined();
      expect(res.body.data.assignments).toBeDefined();
    });

    it('returns 404 for unknown grievance', async () => {
      const res = await request(app)
        .get('/api/grievances/000000000000000000000000')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/grievances/:id/status', () => {
    it('allows admin to update status through valid transition', async () => {
      const grievance = await createGrievance(GrievanceStatus.SUBMITTED);

      const res = await request(app)
        .patch(`/api/grievances/${grievance._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: GrievanceStatus.ACKNOWLEDGED, note: 'Acknowledged' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(GrievanceStatus.ACKNOWLEDGED);
    });

    it('rejects an invalid status transition', async () => {
      const grievance = await createGrievance(GrievanceStatus.SUBMITTED);

      // SUBMITTED -> RESOLVED is not a valid transition
      const res = await request(app)
        .patch(`/api/grievances/${grievance._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: GrievanceStatus.RESOLVED });

      expect(res.status).toBe(400);
    });

    it('rejects status update from a STAFF user', async () => {
      const grievance = await createGrievance();

      const res = await request(app)
        .patch(`/api/grievances/${grievance._id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: GrievanceStatus.ACKNOWLEDGED });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/grievances/:id/assign', () => {
    it('allows admin to assign a grievance', async () => {
      const grievance = await createGrievance(GrievanceStatus.UNDER_REVIEW);

      const res = await request(app)
        .post(`/api/grievances/${grievance._id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ primaryAssigneeId: staff._id, supportingAssigneeIds: [] });

      expect(res.status).toBe(200);
      expect(res.body.data.primaryAssigneeId).toBe(staff._id);
    });

    it('rejects assignment from a STAFF user', async () => {
      const grievance = await createGrievance();

      const res = await request(app)
        .post(`/api/grievances/${grievance._id}/assign`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ primaryAssigneeId: staff._id, supportingAssigneeIds: [] });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/grievances/:id/updates', () => {
    it('allows any authenticated user to add an update', async () => {
      const grievance = await createGrievance();

      const res = await request(app)
        .post(`/api/grievances/${grievance._id}/updates`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ type: 'INTERNAL_NOTE', content: 'Investigating the issue.' });

      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('INTERNAL_NOTE');
    });

    it('rejects an update with empty content', async () => {
      const grievance = await createGrievance();

      const res = await request(app)
        .post(`/api/grievances/${grievance._id}/updates`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ type: 'INTERNAL_NOTE', content: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/grievances/dashboard', () => {
    it('returns dashboard stats', async () => {
      await createGrievance(GrievanceStatus.SUBMITTED);
      await createGrievance(GrievanceStatus.RESOLVED);

      const res = await request(app)
        .get('/api/grievances/dashboard')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.myAssigned).toBeGreaterThanOrEqual(0);
      expect(res.body.data.totalOpen).toBeGreaterThanOrEqual(2);
      expect(res.body.data.recentActivity).toBeDefined();
    });
  });
});
