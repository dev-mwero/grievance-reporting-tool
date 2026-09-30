import { z } from "zod";
import { GrievanceStatus } from "@/types";
import { deletionScopeSchema } from "./common";

export const listGrievancesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(GrievanceStatus).optional(),
  subCountyId: z.string().optional(),
  wardId: z.string().optional(),
  categoryId: z.string().optional(),
  assigneeId: z.string().optional(),
  search: z.string().max(200).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  deletionScope: deletionScopeSchema,
});

export type ListGrievancesQuery = z.infer<typeof listGrievancesQuerySchema>;

/**
 * Administrative amendment of a submitted grievance. Every field is optional
 * so an admin can correct one detail without restating the whole complaint.
 */
export const adminUpdateGrievanceSchema = z
  .object({
    subCountyId: z.string().min(1, "Sub-County is required").optional(),
    wardId: z.string().min(1, "Ward is required").optional(),
    categoryId: z.string().min(1, "Category is required").optional(),
    description: z
      .string()
      .min(1, "Description is required")
      .max(20000, "Description cannot exceed 20000 characters")
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

export type AdminUpdateGrievanceInput = z.infer<
  typeof adminUpdateGrievanceSchema
>;

export const updateStatusSchema = z.object({
  status: z.nativeEnum(GrievanceStatus),
  note: z.string().max(5000).optional(),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

export const assignGrievanceSchema = z.object({
  primaryAssigneeId: z.string().min(1, "Primary assignee is required"),
  supportingAssigneeIds: z.array(z.string()).default([]),
});

export type AssignGrievanceInput = z.infer<typeof assignGrievanceSchema>;

export const addUpdateSchema = z.object({
  type: z.enum(["PUBLIC_UPDATE", "INTERNAL_NOTE"]),
  content: z
    .string()
    .min(1, "Content is required")
    .max(5000, "Content cannot exceed 5000 characters"),
});

export type AddUpdateInput = z.infer<typeof addUpdateSchema>;

export const grievanceParamsSchema = z.object({
  id: z.string().min(1, "Grievance ID is required"),
});

export type GrievanceParams = z.infer<typeof grievanceParamsSchema>;
