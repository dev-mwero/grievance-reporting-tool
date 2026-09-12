import { z } from 'zod';

export const listCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
