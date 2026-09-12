import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  MONGODB_URI: z
    .string()
    .default("mongodb://localhost:27017/grievance_management"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32)
    .default("dev-jwt-access-secret-change-in-production-min-32-chars"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32)
    .default("dev-jwt-refresh-secret-change-in-production-min-32"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  APP_URL: z.string().default("http://localhost:3000"),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("no-reply@grievance.local"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
  );
}

export const env = parsed.data;
