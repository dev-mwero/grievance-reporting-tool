import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import app from '../src/app';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/grievance_test';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
});

beforeEach(async () => {
  // Clear all collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

export { app };
