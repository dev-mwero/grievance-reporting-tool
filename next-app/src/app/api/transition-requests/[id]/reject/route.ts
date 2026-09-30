import type { NextRequest } from "next/server";
import { getActorName, requireRole } from "@/server/auth";
import { handle, ok, validate } from "@/server/http";
import { rejectTransition } from "@/server/services/transition-requests.service";
import { reviewTransitionSchema } from "@/server/validation/transition-requests";
import { Role } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const body = validate(
      reviewTransitionSchema,
      await req.json().catch(() => ({})),
    );
    const request = await rejectTransition(id, body, {
      userId: user.userId,
      name: await getActorName(user),
      role: user.role,
    });
    return ok(request);
  });
}
