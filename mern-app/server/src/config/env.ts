import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z
    .string()
    .default('mongodb://localhost:27017/grievance_management'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32)
    .default('dev-jwt-access-secret-change-in-production-min-32-chars'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32)
    .default('dev-jwt-refresh-secret-change-in-production-min-32'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.coerce.number().default(10_485_760), // 10MB
  MAX_FILES: z.coerce.number().default(5),
  APP_URL: z.string().default('http://localhost:5000'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
