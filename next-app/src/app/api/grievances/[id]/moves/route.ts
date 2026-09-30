import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { getAvailableMoves } from "@/server/services/grievances.service";
import { Role } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.STAFF);
    const { id } = await params;
    return ok(await getAvailableMoves(id, user.userId, user.role));
  });
}
