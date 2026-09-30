import type { NextRequest } from "next/server";
import { getActorName, requireRole } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { approveTransition } from "@/server/services/transition-requests.service";
import { Role } from "@/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const request = await approveTransition(id, {
      userId: user.userId,
      name: await getActorName(user),
      role: user.role,
    });
    return ok(request);
  });
}
