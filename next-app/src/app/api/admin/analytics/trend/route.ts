import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok, readQuery, validate } from "@/server/http";
import { getTrend } from "@/server/services/analytics.service";
import { trendQuerySchema } from "@/server/validation/analytics";
import { Role } from "@/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const query = validate(trendQuerySchema, readQuery(req));
    const result = await getTrend(query);
    return ok(result);
  });
}
