import type { NextRequest } from "next/server";
import { z } from "zod";
import { getActorName, requireRole } from "@/server/auth";
import { createDeletionRoutes } from "@/server/deletion-routes";
import { handle, ok, readQuery, validate } from "@/server/http";
import {
  getGrievanceById,
  purgeGrievance,
  restoreGrievance,
  softDeleteGrievance,
  updateGrievance,
} from "@/server/services/grievances.service";
import { adminUpdateGrievanceSchema } from "@/server/validation/grievances";
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
    const grievance = await getGrievanceById(id, {
      includeDeleted: includeDeleted === "true",
    });
    return ok(grievance);
  });
}

/** Amend a misfiled complaint. The public submission endpoint stays immutable. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const payload = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const body = validate(
      adminUpdateGrievanceSchema,
      await req.json().catch(() => ({})),
    );
    const grievance = await updateGrievance(
      id,
      body,
      payload.userId,
      await getActorName(payload),
    );
    return ok(grievance, 200);
  });
}

const routes = createDeletionRoutes({
  softDelete: softDeleteGrievance,
  restore: restoreGrievance,
  purge: purgeGrievance,
});

export const DELETE = routes.softDelete;
