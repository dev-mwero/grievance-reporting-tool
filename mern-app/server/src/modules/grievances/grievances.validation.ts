import { z } from 'zod';
import { GrievanceStatus } from 'shared';

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
});

export type ListGrievancesQuery = z.infer<typeof listGrievancesQuerySchema>;

export const updateStatusSchema = z.object({
  status: z.nativeEnum(GrievanceStatus),
  note: z.string().max(5000).optional(),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

export const assignGrievanceSchema = z.object({
  primaryAssigneeId: z.string().min(1, 'Primary assignee is required'),
  supportingAssigneeIds: z.array(z.string()).default([]),
});

export type AssignGrievanceInput = z.infer<typeof assignGrievanceSchema>;

export const addUpdateSchema = z.object({
  type: z.enum(['PUBLIC_UPDATE', 'INTERNAL_NOTE']),
  content: z.string().min(1, 'Content is required').max(5000, 'Content cannot exceed 5000 characters'),
});

export type AddUpdateInput = z.infer<typeof addUpdateSchema>;