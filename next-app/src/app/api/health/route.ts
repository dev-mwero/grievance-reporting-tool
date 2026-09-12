import mongoose from "mongoose";

import { handle, ok } from "@/server/http";

export async function GET() {
  return handle(async () => {
    const dbState = mongoose.connection.readyState;
    return ok({
      status: "ok",
      database: dbState === 1 ? "connected" : `state:${dbState}`,
      timestamp: new Date().toISOString(),
    });
  });
}
