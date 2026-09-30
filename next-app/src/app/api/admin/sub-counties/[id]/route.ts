import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth";
import { createDeletionRoutes } from "@/server/deletion-routes";
import { handle, ok, readQuery, validate } from "@/server/http";
import {
  getSubCountyById,
  purgeSubCounty,
  restoreSubCounty,
  softDeleteSubCounty,
  updateSubCounty,
} from "@/server/services/locations.service";
import { updateSubCountySchema } from "@/server/validation/locations";
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
    const subCounty = await getSubCountyById(id, {
      includeDeleted: includeDeleted === "true",
    });
    return ok(subCounty);
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const body = validate(
      updateSubCountySchema,
      await req.json().catch(() => ({})),
    );
    const subCounty = await updateSubCounty(id, body);
    return ok(subCounty, 200);
  });
}

const routes = createDeletionRoutes({
  softDelete: softDeleteSubCounty,
  restore: restoreSubCounty,
  purge: purgeSubCounty,
});

export const DELETE = routes.softDelete;
