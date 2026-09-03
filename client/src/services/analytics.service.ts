import { api } from '../lib/api';
import type { ApiResponse, PaginatedResponse } from 'shared';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  grievances: {
    total: number;
    open: number;
    resolved: number;
    closed: number;
    rejected: number;
    avgResolutionDays: number | null;
  };
  users: {
    total: number;
    active: number;
  };
  configuration: {
    categories: number;
    subCounties: number;
  };
}

export interface StatusDistribution {
  distribution: Record<string, number>;
  total: number;
}

export interface BreakdownItem {
  _id: string | null;
  count: number;
  categoryName?: string;
  subCountyName?: string;
}

export interface Breakdown {
  breakdown: BreakdownItem[];
  total: number;
}

export interface TrendPoint {
  period: string;
  count: number;
  resolved: number;
  closed: number;
}

export interface Trend {
  groupBy: 'day' | 'week' | 'month';
  trend: TrendPoint[];
}

export interface AuditLogEntry {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  actorType: string;
  actorName?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AnalyticsQuery {
  dateFrom?: string;
  dateTo?: string;
}

// ─── Overview ───────────────────────────────────────────────────────────────

export async function getAnalyticsOverview(
  params: AnalyticsQuery = {}
): Promise<AnalyticsOverview> {
  const { data } = await api.get<ApiResponse<AnalyticsOverview>>('/admin/analytics/overview', {
    params,
  });
  return data.data!;
}

// ─── Status Distribution ────────────────────────────────────────────────────

export async function getStatusDistribution(
  params: AnalyticsQuery = {}
): Promise<StatusDistribution> {
  const { data } = await api.get<ApiResponse<StatusDistribution>>(
    '/admin/analytics/status-distribution',
    { params }
  );
  return data.data!;
}

// ─── Category Breakdown ─────────────────────────────────────────────────────

export async function getCategoryBreakdown(
  params: AnalyticsQuery = {}
): Promise<Breakdown> {
  const { data } = await api.get<ApiResponse<Breakdown>>(
    '/admin/analytics/category-breakdown',
    { params }
  );
  return data.data!;
}

// ─── Sub-County Breakdown ───────────────────────────────────────────────────

export async function getSubCountyBreakdown(
  params: AnalyticsQuery = {}
): Promise<Breakdown> {
  const { data } = await api.get<ApiResponse<Breakdown>>(
    '/admin/analytics/sub-county-breakdown',
    { params }
  );
  return data.data!;
}

// ─── Trend ──────────────────────────────────────────────────────────────────

export async function getTrend(
  params: AnalyticsQuery & { groupBy?: 'day' | 'week' | 'month' } = {}
): Promise<Trend> {
  const { data } = await api.get<ApiResponse<Trend>>('/admin/analytics/trend', { params });
  return data.data!;
}

// ─── Audit Logs ─────────────────────────────────────────────────────────────

export async function getAuditLogs(params: {
  page?: number;
  limit?: number;
  entityType?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
} = {}): Promise<PaginatedResponse<AuditLogEntry>> {
  const { data } = await api.get<PaginatedResponse<AuditLogEntry>>(
    '/admin/analytics/audit-logs',
    { params }
  );
  return data;
}
