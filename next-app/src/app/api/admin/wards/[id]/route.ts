import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth";
import { createDeletionRoutes } from "@/server/deletion-routes";
import { handle, ok, readQuery, validate } from "@/server/http";
import {
  getWardById,
  purgeWard,
  restoreWard,
  softDeleteWard,
  updateWard,
} from "@/server/services/locations.service";
import { updateWardSchema } from "@/server/validation/locations";
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
    const ward = await getWardById(id, {
      includeDeleted: includeDeleted === "true",
    });
    return ok(ward);
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const body = validate(updateWardSchema, await req.json().catch(() => ({})));
    const ward = await updateWard(id, body);
    return ok(ward, 200);
  });
}

const routes = createDeletionRoutes({
  softDelete: softDeleteWard,
  restore: restoreWard,
  purge: purgeWard,
});

export const DELETE = routes.softDelete;
