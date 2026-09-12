import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017/grievance_test',
      JWT_ACCESS_SECRET: 'test-jwt-access-secret-change-in-production-min-32-chars',
      JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-change-in-production-min-32',
      PORT: '0',
    },
  },
});
