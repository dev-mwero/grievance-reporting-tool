import { GrievanceStatus, Role } from "@/types";
import { AuditLog } from "../models/audit-log.model";
import { Grievance } from "../models/grievance.model";
import { GrievanceCategory } from "../models/grievance-category.model";
import { SubCounty } from "../models/sub-county.model";
import { User } from "../models/user.model";
import type {
  AnalyticsQuery,
  AuditLogsQuery,
  TrendQuery,
} from "../validation/analytics";

// ─── Overview Stats ─────────────────────────────────────────────────────────

export async function getOverview(query: AnalyticsQuery) {
  const dateFilter = buildDateFilter(query.dateFrom, query.dateTo);

  const [
    total,
    open,
    resolved,
    closed,
    rejected,
    avgResolutionDays,
    totalUsers,
    activeUsers,
    totalCategories,
    totalSubCounties,
  ] = await Promise.all([
    Grievance.countDocuments(dateFilter),
    Grievance.countDocuments({
      ...dateFilter,
      status: { $nin: ["CLOSED", "REJECTED"] },
    }),
    Grievance.countDocuments({ ...dateFilter, status: "RESOLVED" }),
    Grievance.countDocuments({ ...dateFilter, status: "CLOSED" }),
    Grievance.countDocuments({ ...dateFilter, status: "REJECTED" }),
    getAvgResolutionDays(dateFilter),
    User.countDocuments({ role: { $ne: Role.SUPER_ADMIN } }),
    User.countDocuments({
      role: { $ne: Role.SUPER_ADMIN },
      isActive: true,
    }),
    GrievanceCategory.countDocuments({ isActive: true }),
    SubCounty.countDocuments({ isActive: true }),
  ]);

  return {
    grievances: {
      total,
      open,
      resolved,
      closed,
      rejected,
      avgResolutionDays,
    },
    users: {
      total: totalUsers,
      active: activeUsers,
    },
    configuration: {
      categories: totalCategories,
      subCounties: totalSubCounties,
    },
  };
}

// ─── Status Distribution ────────────────────────────────────────────────────

export async function getStatusDistribution(query: AnalyticsQuery) {
  const dateFilter = buildDateFilter(query.dateFrom, query.dateTo);

  const distribution = await Grievance.aggregate([
    { $match: dateFilter },
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const result: Record<string, number> = {};
  Object.values(GrievanceStatus).forEach((status) => {
    result[status] = 0;
  });
  distribution.forEach((d) => {
    result[d._id] = d.count;
  });

  return {
    distribution: result,
    total: Object.values(result).reduce((a, b) => a + b, 0),
  };
}

// ─── Category Breakdown ─────────────────────────────────────────────────────

export async function getCategoryBreakdown(query: AnalyticsQuery) {
  const dateFilter = buildDateFilter(query.dateFrom, query.dateTo);

  const breakdown = await Grievance.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$categoryId",
        count: { $sum: 1 },
        categoryName: { $first: "$categoryName" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return {
    breakdown,
    total: breakdown.reduce((a, b) => a + b.count, 0),
  };
}

// ─── Sub-County Breakdown ───────────────────────────────────────────────────

export async function getSubCountyBreakdown(query: AnalyticsQuery) {
  const dateFilter = buildDateFilter(query.dateFrom, query.dateTo);

  const breakdown = await Grievance.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$subCountyId",
        count: { $sum: 1 },
        subCountyName: { $first: "$subCountyName" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return {
    breakdown,
    total: breakdown.reduce((a, b) => a + b.count, 0),
  };
}

// ─── Time-Series Trend ──────────────────────────────────────────────────────

export async function getTrend(query: TrendQuery) {
  const { dateFrom, dateTo, groupBy } = query;
  const dateFilter = buildDateFilter(dateFrom, dateTo);

  let groupId: Record<string, unknown>;
  switch (groupBy) {
    case "day":
      groupId = {
        year: { $year: "$submittedAt" },
        month: { $month: "$submittedAt" },
        day: { $dayOfMonth: "$submittedAt" },
      };
      break;
    case "week":
      groupId = {
        year: { $year: "$submittedAt" },
        week: { $week: "$submittedAt" },
      };
      break;
    default:
      groupId = {
        year: { $year: "$submittedAt" },
        month: { $month: "$submittedAt" },
      };
  }

  const trend = await Grievance.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: groupId,
        count: { $sum: 1 },
        resolved: {
          $sum: { $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0] },
        },
        closed: {
          $sum: { $cond: [{ $eq: ["$status", "CLOSED"] }, 1, 0] },
        },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 } },
  ]);

  const formatted = trend.map((t) => {
    const id = t._id as Record<string, number>;
    let period: string;
    if (groupBy === "day") {
      period = `${id.year}-${String(id.month).padStart(2, "0")}-${String(id.day).padStart(2, "0")}`;
    } else if (groupBy === "week") {
      period = `${id.year}-W${String(id.week).padStart(2, "0")}`;
    } else {
      period = `${id.year}-${String(id.month).padStart(2, "0")}`;
    }
    return { period, count: t.count, resolved: t.resolved, closed: t.closed };
  });

  return { groupBy, trend: formatted };
}

// ─── Audit Logs ─────────────────────────────────────────────────────────────

export async function getAuditLogs(query: AuditLogsQuery) {
  const {
    page,
    limit,
    entityType,
    entityId,
    actorId,
    action,
    dateFrom,
    dateTo,
  } = query;

  const filter: Record<string, unknown> = {};
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (actorId) filter.actorId = actorId;
  if (action) filter.action = action;

  if (dateFrom || dateTo) {
    filter.timestamp = {};
    if (dateFrom)
      (filter.timestamp as Record<string, unknown>).$gte = new Date(dateFrom);
    if (dateTo)
      (filter.timestamp as Record<string, unknown>).$lte = new Date(dateTo);
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildDateFilter(
  dateFrom?: string,
  dateTo?: string,
): Record<string, unknown> {
  if (!dateFrom && !dateTo) return {};
  const filter: Record<string, unknown> = { submittedAt: {} };
  if (dateFrom)
    (filter.submittedAt as Record<string, unknown>).$gte = new Date(dateFrom);
  if (dateTo)
    (filter.submittedAt as Record<string, unknown>).$lte = new Date(dateTo);
  return filter;
}

async function getAvgResolutionDays(
  dateFilter: Record<string, unknown>,
): Promise<number | null> {
  const result = await Grievance.aggregate([
    { $match: { ...dateFilter, resolvedAt: { $exists: true } } },
    {
      $project: {
        days: {
          $divide: [
            { $subtract: ["$resolvedAt", "$submittedAt"] },
            1000 * 60 * 60 * 24,
          ],
        },
      },
    },
    { $group: { _id: null, avg: { $avg: "$days" } } },
  ]);

  if (result.length === 0) return null;
  return Math.round(result[0].avg * 10) / 10;
}
