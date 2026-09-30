import { ApiError } from "../api-error";
import {
  GrievanceCategory,
  type IGrievanceCategory,
} from "../models/grievance-category.model";
import { type DeletionScope, deletionFilter } from "../models/soft-delete";
import { AuditAction } from "./audit.service";
import { logCategoryEvent } from "./audit-impl";
import {
  type DeletionActor,
  type DeletionHooks,
  type DeletionTarget,
  purgeRecord,
  restoreRecord,
  softDeleteRecord,
} from "./deletion.service";

const target: DeletionTarget<IGrievanceCategory> = {
  label: "Category",
  entityType: "GrievanceCategory",
  model: GrievanceCategory,
};

const actions = {
  softDelete: AuditAction.CATEGORY_SOFT_DELETED,
  restore: AuditAction.CATEGORY_RESTORED,
  purge: AuditAction.CATEGORY_PURGED,
};

/**
 * A soft-deleted record still occupies its unique name, so a create that
 * collides with one needs a different remedy than a plain duplicate.
 */
async function assertNameAvailable(name: string): Promise<void> {
  const existing = await GrievanceCategory.findOne({ name }).select(
    "deletedAt",
  );
  if (!existing) return;
  throw ApiError.conflict(
    existing.deletedAt
      ? "A category with this name exists but is deleted — restore or permanently delete it first"
      : "A category with this name already exists",
  );
}

// ─── List Categories ────────────────────────────────────────────────────────

export async function listCategories(query: {
  page: number;
  limit: number;
  search?: string;
  isActive?: string;
  deletionScope?: DeletionScope;
}) {
  const { page, limit, search, isActive, deletionScope } = query;

  const filter: Record<string, unknown> = { ...deletionFilter(deletionScope) };

  if (search) filter.name = { $regex: search, $options: "i" };
  if (isActive) filter.isActive = isActive === "true";

  const [categories, total] = await Promise.all([
    GrievanceCategory.find(filter)
      .populate("deletedBy", "name email")
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

export async function getCategoryById(
  categoryId: string,
  { includeDeleted = false }: { includeDeleted?: boolean } = {},
) {
  const filter: Record<string, unknown> = includeDeleted
    ? {}
    : deletionFilter();
  const category = await GrievanceCategory.findOne({
    _id: categoryId,
    ...filter,
  });
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
  await assertNameAvailable(input.name);

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

  if (category.deletedAt) {
    throw ApiError.badRequest(
      "Cannot edit a deleted category — restore it first",
    );
  }

  if (input.name && input.name !== category.name) {
    await assertNameAvailable(input.name as string);
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

// ─── Soft Delete / Restore / Purge ──────────────────────────────────────────

const hooks: DeletionHooks<IGrievanceCategory> = {
  // Hiding a deleted category keeps it off the public submission form without
  // discarding the flag an admin may have set deliberately.
  beforeSoftDelete: (doc) => {
    doc.isActive = false;
  },
  beforeRestore: (doc) => {
    doc.isActive = true;
  },
  metadata: (doc) => ({ name: doc.name }),
};

export async function softDeleteCategory(
  categoryId: string,
  actor: DeletionActor,
  reason?: string,
) {
  return softDeleteRecord(target, actions, categoryId, actor, hooks, reason);
}

export async function restoreCategory(
  categoryId: string,
  actor: DeletionActor,
) {
  return restoreRecord(target, actions, categoryId, actor, hooks);
}

export async function purgeCategory(categoryId: string, actor: DeletionActor) {
  return purgeRecord(target, actions, categoryId, actor, hooks);
}
