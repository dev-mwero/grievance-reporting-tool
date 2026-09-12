import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth";
import { handle, paginated, readQuery, validate } from "@/server/http";
import { listGrievances } from "@/server/services/grievances.service";
import { listGrievancesQuerySchema } from "@/server/validation/grievances";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAuth();
    const query = validate(listGrievancesQuerySchema, readQuery(req));
    const { grievances, pagination } = await listGrievances(query);
    return paginated(grievances, pagination);
  });
}
