import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok, validate } from "@/server/http";
import { getUserById, updateUser } from "@/server/services/users.service";
import { updateUserSchema } from "@/server/validation/users";
import { Role } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const user = await getUserById(id);
    return ok(user);
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const viewer = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const body = validate(updateUserSchema, await req.json().catch(() => ({})));
    const user = await updateUser(id, body, viewer.role as Role);
    return ok(user, 200);
  });
}
