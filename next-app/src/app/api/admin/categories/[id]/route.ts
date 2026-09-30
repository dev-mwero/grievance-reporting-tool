import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth";
import { createDeletionRoutes } from "@/server/deletion-routes";
import { handle, ok, readQuery, validate } from "@/server/http";
import {
  getCategoryById,
  purgeCategory,
  restoreCategory,
  softDeleteCategory,
  updateCategory,
} from "@/server/services/categories.service";
import { updateCategorySchema } from "@/server/validation/categories";
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
    const category = await getCategoryById(id, {
      includeDeleted: includeDeleted === "true",
    });
    return ok(category);
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
      updateCategorySchema,
      await req.json().catch(() => ({})),
    );
    const category = await updateCategory(id, body);
    return ok(category, 200);
  });
}

const routes = createDeletionRoutes({
  softDelete: softDeleteCategory,
  restore: restoreCategory,
  purge: purgeCategory,
});

export const DELETE = routes.softDelete;
