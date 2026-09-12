import { z } from 'zod';
import { GrievanceStatus } from 'shared';

export const analyticsQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export const trendQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('month'),
});

export type TrendQuery = z.infer<typeof trendQuerySchema>;

export const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;