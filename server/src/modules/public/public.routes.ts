import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { uploadMultiple } from '../../middleware/upload';
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

// GET /api/public/stats
router.get('/stats', publicController.getPublicStats);

// ─── Submit Grievance (Public, no auth) ─────────────────────────────────────

// POST /api/public/grievances
// Accepts multipart/form-data with fields (subCountyId, wardId, categoryId, description)
// and optional files (up to 5) under the 'files' field name.
router.post(
  '/grievances',
  uploadMultiple,
  validate(submitGrievanceSchema),
  publicController.submitGrievance
);

// ─── Track Grievance (Public, no auth) ──────────────────────────────────────

// GET /api/public/grievances/:referenceCode
router.get(
  '/grievances/:referenceCode',
  validate(trackGrievanceParamsSchema, 'params'),
  publicController.trackGrievance
);

export default router;
