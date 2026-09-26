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
  /**
   * When true the limit applies across every client rather than per-IP. Use
   * to bound work whose cost scales with the server, not the caller — most
   * importantly outbound email fan-out on anonymous endpoints, which a
   * per-IP limit cannot bound when the source rotates addresses.
   */
  global?: boolean;
}

/** Increment a windowed counter, throwing once it is exhausted. */
async function consume(key: string, options: RateLimitOptions): Promise<void> {
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

/**
 * Fixed-window MongoDB-backed rate limiter, suitable for serverless
 * deployments where in-memory counters do not work. Uses a per-IP+scope key,
 * or a single shared key when `global` is set.
 */
export async function checkRateLimit(
  req: NextRequest,
  scope: string,
  options: RateLimitOptions,
): Promise<void> {
  await connectToDatabase();
  const ip = clientIp(req);
  await consume(options.global ? `${scope}:global` : `${scope}:${ip}`, options);
}

/**
 * Rate limit by an arbitrary caller-supplied key rather than by IP, for
 * threats a per-IP limit cannot see — chiefly credential stuffing spread
 * across many addresses against one account. The key is lowercased so
 * `Jane@Gov.go.ke` and `jane@gov.go.ke` cannot hold separate budgets.
 */
export async function checkRateLimitByKey(
  key: string,
  scope: string,
  options: RateLimitOptions,
): Promise<void> {
  await connectToDatabase();
  await consume(`${scope}:${key.toLowerCase()}`, options);
}
