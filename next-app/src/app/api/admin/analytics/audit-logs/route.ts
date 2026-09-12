import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, paginated, readQuery, validate } from "@/server/http";
import { getAuditLogs } from "@/server/services/analytics.service";
import { auditLogsQuerySchema } from "@/server/validation/analytics";
import { Role } from "@/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const query = validate(auditLogsQuerySchema, readQuery(req));
    const { logs, pagination } = await getAuditLogs(query);
    return paginated(logs, pagination);
  });
}
