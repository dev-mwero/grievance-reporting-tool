import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { Role } from 'shared';
import {
  listSubCountiesQuerySchema,
  createSubCountySchema,
  updateSubCountySchema,
  listWardsQuerySchema,
  createWardSchema,
  updateWardSchema,
} from './locations.validation';
import * as locationsController from './locations.controller';

const router = Router();

// All routes require authentication and ADMIN role or higher
router.use(authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN));

// ─── Sub-Counties ───────────────────────────────────────────────────────────

// GET /api/admin/sub-counties
router.get(
  '/sub-counties',
  validate(listSubCountiesQuerySchema, 'query'),
  locationsController.listSubCounties
);

// GET /api/admin/sub-counties/:id
router.get('/sub-counties/:id', locationsController.getSubCounty);

// POST /api/admin/sub-counties
router.post('/sub-counties', validate(createSubCountySchema), locationsController.createSubCounty);

// PATCH /api/admin/sub-counties/:id
router.patch(
  '/sub-counties/:id',
  validate(updateSubCountySchema),
  locationsController.updateSubCounty
);

// POST /api/admin/sub-counties/:id/deactivate
router.post('/sub-counties/:id/deactivate', locationsController.deactivateSubCounty);

// ─── Wards ──────────────────────────────────────────────────────────────────

// GET /api/admin/wards
router.get('/wards', validate(listWardsQuerySchema, 'query'), locationsController.listWards);

// GET /api/admin/wards/:id
router.get('/wards/:id', locationsController.getWard);

// POST /api/admin/wards
router.post('/wards', validate(createWardSchema), locationsController.createWard);

// PATCH /api/admin/wards/:id
router.patch('/wards/:id', validate(updateWardSchema), locationsController.updateWard);

// POST /api/admin/wards/:id/deactivate
router.post('/wards/:id/deactivate', locationsController.deactivateWard);

export default router;
