import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth";
import { createDeletionRoutes } from "@/server/deletion-routes";
import { handle, ok, readQuery, validate } from "@/server/http";
import {
  getUserById,
  purgeUser,
  restoreUser,
  softDeleteUser,
  updateUser,
} from "@/server/services/users.service";
import { updateUserSchema } from "@/server/validation/users";
import { Role } from "@/types";

const includeDeletedSchema = z.object({
  includeDeleted: z.enum(["true", "false"]).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const { includeDeleted } = includeDeletedSchema.parse(readQuery(req));
    const user = await getUserById(id, {
      includeDeleted: includeDeleted === "true",
    });
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

const routes = createDeletionRoutes({
  softDelete: softDeleteUser,
  restore: restoreUser,
  purge: purgeUser,
});

export const DELETE = routes.softDelete;
