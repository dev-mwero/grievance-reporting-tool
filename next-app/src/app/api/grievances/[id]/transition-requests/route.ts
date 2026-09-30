import type { NextRequest } from "next/server";
import { getActorName, requireRole } from "@/server/auth";
import { created, handle, ok, validate } from "@/server/http";
import {
  listForGrievance,
  proposeTransition,
} from "@/server/services/transition-requests.service";
import { proposeTransitionSchema } from "@/server/validation/transition-requests";
import { Role } from "@/types";

/** A complaint's proposal history, so the detail page can show what was asked. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.STAFF);
    const { id } = await params;
    return ok(await listForGrievance(id));
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.STAFF);
    const { id } = await params;
    const body = validate(
      proposeTransitionSchema,
      await req.json().catch(() => ({})),
    );

    const request = await proposeTransition(
      id,
      body,
      user.userId,
      await getActorName(user),
      user.role,
    );
    return created(request, "Move sent for approval");
  });
}
