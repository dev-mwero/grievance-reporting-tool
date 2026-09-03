import { Router } from 'express';
import { validate } from '../../middleware/validate';
import {
  submitGrievanceSchema,
  trackGrievanceParamsSchema,
  listWardsBySubCountyQuerySchema,
} from './public.validation';
import * as publicController from './public.controller';

const router = Router();

// ─── Lookup Data (Public, no auth) ──────────────────────────────────────────

// GET /api/public/sub-counties
router.get('/sub-counties', publicController.listSubCounties);

// GET /api/public/wards?subCountyId=...
router.get(
  '/wards',
  validate(listWardsBySubCountyQuerySchema, 'query'),
  publicController.listWardsBySubCounty
);

// GET /api/public/categories
router.get('/categories', publicController.listCategories);

// ─── Submit Grievance (Public, no auth) ─────────────────────────────────────

// POST /api/public/grievances
router.post('/grievances', validate(submitGrievanceSchema), publicController.submitGrievance);

// ─── Track Grievance (Public, no auth) ──────────────────────────────────────

// GET /api/public/grievances/:referenceCode
router.get(
  '/grievances/:referenceCode',
  validate(trackGrievanceParamsSchema, 'params'),
  publicController.trackGrievance
);

export default router;
