import type { Request, Response } from 'express';
import * as analyticsService from './analytics.service';
import type { AnalyticsQuery, TrendQuery, AuditLogsQuery } from './analytics.validation';

export async function getOverview(req: Request, res: Response): Promise<void> {
  const query = req.validated as unknown as AnalyticsQuery;
  const data = await analyticsService.getOverview(query);

  res.json({
    success: true,
    data,
  });
}

export async function getStatusDistribution(req: Request, res: Response): Promise<void> {
  const query = req.validated as unknown as AnalyticsQuery;
  const data = await analyticsService.getStatusDistribution(query);

  res.json({
    success: true,
    data,
  });
}

export async function getCategoryBreakdown(req: Request, res: Response): Promise<void> {
  const query = req.validated as unknown as AnalyticsQuery;
  const data = await analyticsService.getCategoryBreakdown(query);

  res.json({
    success: true,
    data,
  });
}

export async function getSubCountyBreakdown(req: Request, res: Response): Promise<void> {
  const query = req.validated as unknown as AnalyticsQuery;
  const data = await analyticsService.getSubCountyBreakdown(query);

  res.json({
    success: true,
    data,
  });
}

export async function getTrend(req: Request, res: Response): Promise<void> {
  const query = req.validated as unknown as TrendQuery;
  const data = await analyticsService.getTrend(query);

  res.json({
    success: true,
    data,
  });
}

export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  const query = req.validated as unknown as AuditLogsQuery;
  const data = await analyticsService.getAuditLogs(query);

  res.json({
    success: true,
    data: data.logs,
    pagination: data.pagination,
  });
}