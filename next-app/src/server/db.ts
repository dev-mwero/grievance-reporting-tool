import mongoose from "mongoose";
import { env } from "./env";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalWithCache = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

/**
 * Serverless-safe database connection.
 * Reuses an existing connection across warm invocations and only ever
 * establishes a single connection per lambda instance.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (globalWithCache.mongooseCache?.conn) {
    return globalWithCache.mongooseCache.conn;
  }

  if (!globalWithCache.mongooseCache) {
    globalWithCache.mongooseCache = { conn: null, promise: null };
  }

  if (!globalWithCache.mongooseCache.promise) {
    globalWithCache.mongooseCache.promise = mongoose
      .connect(env.MONGODB_URI, {
        bufferCommands: false,
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 10000,
      })
      .then((m) => m);
  }

  globalWithCache.mongooseCache.conn =
    await globalWithCache.mongooseCache.promise;
  return globalWithCache.mongooseCache.conn;
}
