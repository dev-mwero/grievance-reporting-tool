import type { NextRequest } from "next/server";
import { getActorName, requireRole } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { withdrawTransition } from "@/server/services/transition-requests.service";
import { Role } from "@/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.STAFF);
    const { id } = await params;
    const request = await withdrawTransition(
      id,
      user.userId,
      await getActorName(user),
      user.role,
    );
    return ok(request);
  });
}
