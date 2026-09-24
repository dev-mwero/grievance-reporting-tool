import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok, paginated, readQuery, validate } from "@/server/http";
import {
  createCategory,
  listCategories,
} from "@/server/services/categories.service";
import {
  createCategorySchema,
  listCategoriesQuerySchema,
} from "@/server/validation/categories";
import { Role } from "@/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const query = validate(listCategoriesQuerySchema, readQuery(req));
    const { categories, pagination } = await listCategories(query);
    return paginated(categories, pagination, "categories");
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const body = validate(
      createCategorySchema,
      await req.json().catch(() => ({})),
    );
    const category = await createCategory(body);
    return ok(category, 201);
  });
}
