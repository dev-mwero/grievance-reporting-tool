import { z } from 'zod';

export const listAttachmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListAttachmentsQuery = z.infer<typeof listAttachmentsQuerySchema>;