import { z } from "zod";

export const listSubCountiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type ListSubCountiesQuery = z.infer<typeof listSubCountiesQuerySchema>;

export const createSubCountySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  code: z.string().min(1, "Code is required").max(50),
});

export type CreateSubCountyInput = z.infer<typeof createSubCountySchema>;

export const updateSubCountySchema = z.object({
  name: z.string().min(1, "Name is required").max(200).optional(),
  code: z.string().min(1, "Code is required").max(50).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSubCountyInput = z.infer<typeof updateSubCountySchema>;

export const listWardsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  subCountyId: z.string().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type ListWardsQuery = z.infer<typeof listWardsQuerySchema>;

export const createWardSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  code: z.string().min(1, "Code is required").max(50),
  subCountyId: z.string().min(1, "Sub-County is required"),
});

export type CreateWardInput = z.infer<typeof createWardSchema>;

export const updateWardSchema = z.object({
  name: z.string().min(1, "Name is required").max(200).optional(),
  code: z.string().min(1, "Code is required").max(50).optional(),
  subCountyId: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateWardInput = z.infer<typeof updateWardSchema>;

export const locationParamsSchema = z.object({
  id: z.string().min(1, "Location ID is required"),
});

export type LocationParams = z.infer<typeof locationParamsSchema>;
