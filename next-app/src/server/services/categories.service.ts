import { ApiError } from "../api-error";
import { GrievanceCategory } from "../models/grievance-category.model";
import { AuditAction } from "./audit.service";
import { logCategoryEvent } from "./audit-impl";

// ─── List Categories ────────────────────────────────────────────────────────

export async function listCategories(query: {
  page: number;
  limit: number;
  search?: string;
  isActive?: string;
}) {
  const { page, limit, search, isActive } = query;

  const filter: Record<string, unknown> = {};

  if (search) filter.name = { $regex: search, $options: "i" };
  if (isActive) filter.isActive = isActive === "true";

  const [categories, total] = await Promise.all([
    GrievanceCategory.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    GrievanceCategory.countDocuments(filter),
  ]);

  return {
    categories,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ─── Get Category ───────────────────────────────────────────────────────────

export async function getCategoryById(categoryId: string) {
  const category = await GrievanceCategory.findById(categoryId);
  if (!category) {
    throw ApiError.notFound("Category not found");
  }
  return category;
}

// ─── Create Category ────────────────────────────────────────────────────────

export async function createCategory(input: {
  name: string;
  description?: string;
}) {
  const existing = await GrievanceCategory.findOne({ name: input.name });
  if (existing) {
    throw ApiError.conflict("A category with this name already exists");
  }

  const category = await GrievanceCategory.create(input);

  await logCategoryEvent(
    AuditAction.CATEGORY_CREATED,
    category._id.toString(),
    undefined,
    undefined,
    { name: category.name },
  );

  return category;
}

// ─── Update Category ────────────────────────────────────────────────────────

export async function updateCategory(
  categoryId: string,
  input: Record<string, unknown>,
) {
  const category = await GrievanceCategory.findById(categoryId);
  if (!category) {
    throw ApiError.notFound("Category not found");
  }

  if (input.name && input.name !== category.name) {
    const existing = await GrievanceCategory.findOne({ name: input.name });
    if (existing) {
      throw ApiError.conflict("A category with this name already exists");
    }
  }

  Object.assign(category, input);
  await category.save();

  await logCategoryEvent(
    AuditAction.CATEGORY_UPDATED,
    category._id.toString(),
    undefined,
    undefined,
    { changes: Object.keys(input) },
  );

  return category;
}

// ─── Deactivate Category ────────────────────────────────────────────────────

export async function deactivateCategory(categoryId: string) {
  const category = await GrievanceCategory.findById(categoryId);
  if (!category) {
    throw ApiError.notFound("Category not found");
  }

  category.isActive = false;
  await category.save();

  await logCategoryEvent(
    AuditAction.CATEGORY_DEACTIVATED,
    category._id.toString(),
    undefined,
    undefined,
  );

  return category;
}
