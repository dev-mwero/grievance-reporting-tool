import bcrypt from 'bcryptjs';
import request from 'supertest';
import { Role } from 'shared';
import { User } from '../src/models/user.model';
import { GrievanceCategory } from '../src/models/grievance-category.model';
import { SubCounty } from '../src/models/sub-county.model';
import { Ward } from '../src/models/ward.model';
import { app } from './setup';

const SALT_ROUNDS = 10;

export interface TestUser {
  _id: string;
  name: string;
  email: string;
  role: Role;
  password: string;
}

/**
 * Create a user directly in the database (bypassing the API).
 */
export async function createUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const password = overrides.password ?? 'TestPass123!';
  const user = await User.create({
    name: overrides.name ?? 'Test User',
    email: overrides.email ?? `user-${Date.now()}@test.com`,
    role: overrides.role ?? Role.STAFF,
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    isActive: true,
  });
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    password,
  };
}

/**
 * Create an admin user (SUPER_ADMIN).
 */
export async function createAdmin(): Promise<TestUser> {
  return createUser({ role: Role.SUPER_ADMIN, email: `admin-${Date.now()}@test.com` });
}

/**
 * Login and return the access token.
 */
export async function loginAndGetToken(user: TestUser): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: user.password });
  return res.body.data.accessToken;
}

/**
 * Create a category directly in the database.
 */
export async function createCategory(name = 'Infrastructure') {
  return GrievanceCategory.create({ name, description: 'Test category' });
}

/**
 * Create a sub-county directly in the database.
 */
export async function createSubCounty(name = 'Central', code = 'CEN') {
  return SubCounty.create({ name, code });
}

/**
 * Create a ward directly in the database.
 */
export async function createWard(subCountyId: string, name = 'Downtown', code = 'DTN') {
  return Ward.create({ name, code, subCountyId });
}

/**
 * Seed a full set of lookup data (category, sub-county, ward).
 * Returns the created documents.
 */
export async function seedLookupData() {
  const category = await createCategory();
  const subCounty = await createSubCounty();
  const ward = await createWard(subCounty._id.toString());
  return { category, subCounty, ward };
}
