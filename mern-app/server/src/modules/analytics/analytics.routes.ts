import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { Role } from 'shared';
import {
  analyticsQuerySchema,
  trendQuerySchema,
  auditLogsQuerySchema,
} from './analytics.validation';
import * as analyticsController from './analytics.controller';

const router = Router();

// All routes require authentication and ADMIN role or higher
router.use(authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN));

// GET /api/admin/analytics/overview
router.get(
  '/overview',
  validate(analyticsQuerySchema, 'query'),
  analyticsController.getOverview
);

// GET /api/admin/analytics/status-distribution
router.get(
  '/status-distribution',
  validate(analyticsQuerySchema, 'query'),
  analyticsController.getStatusDistribution
);

// GET /api/admin/analytics/category-breakdown
router.get(
  '/category-breakdown',
  validate(analyticsQuerySchema, 'query'),
  analyticsController.getCategoryBreakdown
);

// GET /api/admin/analytics/sub-county-breakdown
router.get(
  '/sub-county-breakdown',
  validate(analyticsQuerySchema, 'query'),
  analyticsController.getSubCountyBreakdown
);

// GET /api/admin/analytics/trend
router.get('/trend', validate(trendQuerySchema, 'query'), analyticsController.getTrend);

// GET /api/admin/analytics/audit-logs
router.get(
  '/audit-logs',
  validate(auditLogsQuerySchema, 'query'),
  analyticsController.getAuditLogs
);

export default router;