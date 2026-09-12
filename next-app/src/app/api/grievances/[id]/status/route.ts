import type { NextRequest } from "next/server";
import { getActorName, requireRole } from "@/server/auth";
import { handle, ok, validate } from "@/server/http";
import { updateStatus } from "@/server/services/grievances.service";
import { updateStatusSchema } from "@/server/validation/grievances";
import { Role } from "@/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const body = validate(
      updateStatusSchema,
      await req.json().catch(() => ({})),
    );
    const actorName = await getActorName(user);
    const grievance = await updateStatus(id, body, user.userId, actorName);
    return ok(grievance, 200);
  });
}
