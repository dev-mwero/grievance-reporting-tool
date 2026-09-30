import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, paginated, readQuery, validate } from "@/server/http";
import { listRequests } from "@/server/services/transition-requests.service";
import { listTransitionRequestsQuerySchema } from "@/server/validation/transition-requests";
import { Role } from "@/types";

/** The admin approval queue. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const query = validate(listTransitionRequestsQuerySchema, readQuery(req));
    const { requests, pagination } = await listRequests(query);
    return paginated(requests, pagination, "requests");
  });
}
