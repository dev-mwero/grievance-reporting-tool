import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Role } from 'shared';
import { app } from './setup';
import { createUser, createAdmin, loginAndGetToken } from './helpers';

describe('Admin API', () => {
  let admin: Awaited<ReturnType<typeof createAdmin>>;
  let staff: Awaited<ReturnType<typeof createUser>>;
  let adminToken: string;
  let staffToken: string;

  beforeEach(async () => {
    admin = await createAdmin();
    staff = await createUser({ email: 'staff-admin@test.com' });
    adminToken = await loginAndGetToken(admin);
    staffToken = await loginAndGetToken(staff);
  });

  describe('Authorization', () => {
    it('rejects admin routes for STAFF users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    it('rejects admin routes without authentication', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });
  });

  describe('Users', () => {
    it('creates a user', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Staff',
          email: 'newstaff-admin@test.com',
          role: Role.STAFF,
          password: 'TestPass123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('newstaff-admin@test.com');
      expect(res.body.data.role).toBe(Role.STAFF);
    });

    it('rejects creating a user with a weak password', async () => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Weak Pass',
          email: 'weak@test.com',
          role: Role.STAFF,
          password: 'weak',
        });

      expect(res.status).toBe(400);
    });

    it('lists users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('updates a user', async () => {
      const target = await createUser({ email: 'update-target@test.com' });

      const res = await request(app)
        .patch(`/api/admin/users/${target._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Senior Officer', department: 'Public Works' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Senior Officer');
      expect(res.body.data.department).toBe('Public Works');
    });

    it('deactivates a user', async () => {
      const target = await createUser({ email: 'deactivate-target@test.com' });

      const res = await request(app)
        .post(`/api/admin/users/${target._id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });
  });

  describe('Invitations', () => {
    it('creates an invitation', async () => {
      const res = await request(app)
        .post('/api/admin/users/invitations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'invitee@test.com',
          name: 'Invitee',
          role: Role.STAFF,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('invitee@test.com');
      expect(res.body.data.acceptedAt).toBeUndefined();
    });

    it('lists invitations', async () => {
      // Create an invitation first
      await request(app)
        .post('/api/admin/users/invitations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'list-invitee@test.com', name: 'List Invitee', role: Role.STAFF });

      const res = await request(app)
        .get('/api/admin/users/invitations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Categories', () => {
    it('creates a category', async () => {
      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Health', description: 'Health-related grievances' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Health');
    });

    it('rejects a duplicate category name', async () => {
      await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Education' });

      const res = await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Education' });

      expect(res.status).toBe(409);
    });

    it('lists categories', async () => {
      // Create a category first
      await request(app)
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Water' });

      const res = await request(app)
        .get('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Sub-Counties', () => {
    it('creates a sub-county', async () => {
      const res = await request(app)
        .post('/api/admin/sub-counties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'North', code: 'NTH' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('North');
    });

    it('lists sub-counties', async () => {
      // Create a sub-county first
      await request(app)
        .post('/api/admin/sub-counties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'South', code: 'STH' });

      const res = await request(app)
        .get('/api/admin/sub-counties')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Wards', () => {
    it('creates a ward under a sub-county', async () => {
      // Create a sub-county first
      const subCountyRes = await request(app)
        .post('/api/admin/sub-counties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'East', code: 'EST' });
      const subCountyId = subCountyRes.body.data._id;

      const res = await request(app)
        .post('/api/admin/wards')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Riverside', code: 'RVR', subCountyId });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Riverside');
      expect(res.body.data.subCountyId).toBe(subCountyId);
    });

    it('lists wards', async () => {
      // Create a sub-county and ward first
      const subCountyRes = await request(app)
        .post('/api/admin/sub-counties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'West', code: 'WST' });
      const subCountyId = subCountyRes.body.data._id;

      await request(app)
        .post('/api/admin/wards')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Lakeside', code: 'LKS', subCountyId });

      const res = await request(app)
        .get('/api/admin/wards')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
