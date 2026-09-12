import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok, validate } from "@/server/http";
import {
  getCategoryById,
  updateCategory,
} from "@/server/services/categories.service";
import { updateCategorySchema } from "@/server/validation/categories";
import { Role } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const category = await getCategoryById(id);
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
