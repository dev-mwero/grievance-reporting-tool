import mongoose, { type Document, Schema } from "mongoose";
import type { NextRequest } from "next/server";
import { ApiError } from "./api-error";
import { connectToDatabase } from "./db";
import { clientIp } from "./http";

interface IRateLimit extends Document {
  key: string;
  count: number;
  expiresAt: Date;
}

const rateLimitSchema = new Schema<IRateLimit>(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit =
  (mongoose.models.RateLimit as mongoose.Model<IRateLimit>) ??
  mongoose.model<IRateLimit>("RateLimit", rateLimitSchema);

export interface RateLimitOptions {
  windowSeconds: number;
  max: number;
}

/**
 * Fixed-window MongoDB-backed rate limiter, suitable for serverless
 * deployments where in-memory counters do not work. Uses a per-IP+scope key.
 */
export async function checkRateLimit(
  req: NextRequest,
  scope: string,
  options: RateLimitOptions,
): Promise<void> {
  await connectToDatabase();
  const ip = clientIp(req);
  const key = `${scope}:${ip}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + options.windowSeconds * 1000);

  const existing = await RateLimit.findOne({ key });
  if (!existing || existing.expiresAt.getTime() <= now.getTime()) {
    await RateLimit.updateOne(
      { key },
      { $set: { count: 1, expiresAt } },
      { upsert: true },
    );
    return;
  }

  if (existing.count >= options.max) {
    const retryAfter = Math.ceil(
      (existing.expiresAt.getTime() - now.getTime()) / 1000,
    );
    throw new ApiError(
      429,
      `Too many attempts. Please try again in ${Math.max(1, retryAfter)} seconds.`,
    );
  }

  await RateLimit.updateOne({ key }, { $inc: { count: 1 } });
}
