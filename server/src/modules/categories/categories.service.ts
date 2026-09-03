import { GrievanceCategory } from '../../models/grievance-category.model';
import { ApiError } from '../../utils/api-error';
import type {
  ListCategoriesQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './categories.validation';

// ─── List Categories ────────────────────────────────────────────────────────

export async function listCategories(query: ListCategoriesQuery) {
  const { page, limit, search, isActive } = query;

  const filter: Record<string, unknown> = {};

  if (search) {
    filter.name = { $regex: search, $options: 'i' };
  }

  if (isActive) {
    filter.isActive = isActive === 'true';
  }

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
    throw ApiError.notFound('Category not found');
  }
  return category;
}

// ─── Create Category ────────────────────────────────────────────────────────

export async function createCategory(input: CreateCategoryInput) {
  const existing = await GrievanceCategory.findOne({ name: input.name });
  if (existing) {
    throw ApiError.conflict('A category with this name already exists');
  }

  const category = await GrievanceCategory.create(input);
  return category;
}

// ─── Update Category ────────────────────────────────────────────────────────

export async function updateCategory(categoryId: string, input: UpdateCategoryInput) {
  const category = await GrievanceCategory.findById(categoryId);
  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  if (input.name && input.name !== category.name) {
    const existing = await GrievanceCategory.findOne({ name: input.name });
    if (existing) {
      throw ApiError.conflict('A category with this name already exists');
    }
  }

  Object.assign(category, input);
  await category.save();

  return category;
}

// ─── Deactivate Category ────────────────────────────────────────────────────

export async function deactivateCategory(categoryId: string) {
  const category = await GrievanceCategory.findById(categoryId);
  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  category.isActive = false;
  await category.save();

  return category;
}
