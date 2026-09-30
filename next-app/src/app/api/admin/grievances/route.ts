import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, paginated, readQuery, validate } from "@/server/http";
import { listGrievances } from "@/server/services/grievances.service";
import { listGrievancesQuerySchema } from "@/server/validation/grievances";
import { Role } from "@/types";

/**
 * Administrative grievance listing. Unlike the staff-facing
 * `/api/grievances` route this accepts `deletionScope`, so admins can review
 * the soft-deleted tray as well as the live records.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const query = validate(listGrievancesQuerySchema, readQuery(req));
    const { grievances, pagination } = await listGrievances(query);
    return paginated(grievances, pagination, "grievances");
  });
}
