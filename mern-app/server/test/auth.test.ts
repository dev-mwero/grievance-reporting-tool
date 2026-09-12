import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Role } from 'shared';
import { app } from './setup';
import { createUser, createAdmin, loginAndGetToken } from './helpers';

describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials and returns tokens', async () => {
      const user = await createUser({ email: 'login@test.com' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'TestPass123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe('login@test.com');
      expect(res.body.data.user.role).toBe(Role.STAFF);
    });

    it('rejects invalid credentials', async () => {
      await createUser({ email: 'wrongpass@test.com' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrongpass@test.com', password: 'WrongPass123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects login for deactivated users', async () => {
      const user = await createUser({ email: 'inactive@test.com' });
      // Deactivate the user directly
      const { User } = await import('../src/models/user.model');
      await User.findByIdAndUpdate(user._id, { isActive: false });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'inactive@test.com', password: 'TestPass123!' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing fields', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'x@test.com' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/profile', () => {
    it('returns the authenticated user profile', async () => {
      const user = await createUser({ email: 'profile@test.com', name: 'Profile User' });
      const token = await loginAndGetToken(user);

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('profile@test.com');
      expect(res.body.data.name).toBe('Profile User');
      expect(res.body.data.role).toBe(Role.STAFF);
      // passwordHash must never be exposed
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('rejects requests without a token', async () => {
      const res = await request(app).get('/api/auth/profile');
      expect(res.status).toBe(401);
    });

    it('rejects requests with an invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('changes the password successfully', async () => {
      const user = await createUser({ email: 'changepw@test.com' });
      const token = await loginAndGetToken(user);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'TestPass123!',
          newPassword: 'NewPass456!',
          confirmPassword: 'NewPass456!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Old password should no longer work
      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'changepw@test.com', password: 'TestPass123!' });
      expect(oldLogin.status).toBe(401);

      // New password should work
      const newLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'changepw@test.com', password: 'NewPass456!' });
      expect(newLogin.status).toBe(200);
    });

    it('rejects an incorrect current password', async () => {
      const user = await createUser({ email: 'wrongcurrent@test.com' });
      const token = await loginAndGetToken(user);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongPass123!',
          newPassword: 'NewPass456!',
          confirmPassword: 'NewPass456!',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/auth/profile', () => {
    it('updates the current user personal details', async () => {
      const user = await createUser({
        email: 'updateprofile@test.com',
        name: 'Original Name',
      });
      const token = await loginAndGetToken(user);

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Name',
          phone: '+254712345678',
          title: 'Manager',
          department: 'Operations',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.phone).toBe('+254712345678');
      expect(res.body.data.title).toBe('Manager');
      expect(res.body.data.department).toBe('Operations');
    });

    it('rejects updates to role, email, and isActive', async () => {
      const user = await createUser({ email: 'updateprofile-role@test.com' });
      const token = await loginAndGetToken(user);

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          role: Role.SUPER_ADMIN,
          email: 'hacked@test.com',
          isActive: false,
          name: 'Still Works',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(Role.STAFF);
      expect(res.body.data.email).toBe('updateprofile-role@test.com');
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data.name).toBe('Still Works');
    });

    it('rejects invalid name (empty)', async () => {
      const user = await createUser({ email: 'updateprofile-empty@test.com' });
      const token = await loginAndGetToken(user);

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('refreshes the access token', async () => {
      const user = await createUser({ email: 'refresh@test.com' });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'refresh@test.com', password: 'TestPass123!' });
      const refreshToken = loginRes.body.data.refreshToken;

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    });
  });
});
