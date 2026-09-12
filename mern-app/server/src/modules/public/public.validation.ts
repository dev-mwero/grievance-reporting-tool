import { z } from 'zod';

export const submitGrievanceSchema = z.object({
  subCountyId: z.string().min(1, 'Sub-County is required'),
  wardId: z.string().min(1, 'Ward is required'),
  categoryId: z.string().min(1, 'Category is required'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(20000, 'Description cannot exceed 20000 characters'),
});

export type SubmitGrievanceInput = z.infer<typeof submitGrievanceSchema>;

export const trackGrievanceParamsSchema = z.object({
  referenceCode: z
    .string()
    .min(1, 'Reference code is required')
    .regex(/^GRV-\d{4}-[A-F0-9]{8}$/, 'Invalid reference code format'),
});

export type TrackGrievanceParams = z.infer<typeof trackGrievanceParamsSchema>;

export const listWardsBySubCountyQuerySchema = z.object({
  subCountyId: z.string().min(1, 'Sub-County ID is required'),
});

export type ListWardsBySubCountyQuery = z.infer<typeof listWardsBySubCountyQuerySchema>;
