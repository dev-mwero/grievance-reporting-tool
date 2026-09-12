import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { Role } from 'shared';
import {
  listGrievancesQuerySchema,
  updateStatusSchema,
  assignGrievanceSchema,
  addUpdateSchema,
} from './grievances.validation';
import * as grievancesController from './grievances.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── Dashboard (any authenticated user) ─────────────────────────────────────

// GET /api/grievances/dashboard
router.get('/dashboard', grievancesController.getDashboardStats);

// ─── List & Detail (any authenticated user) ─────────────────────────────────

// GET /api/grievances
router.get('/', validate(listGrievancesQuerySchema, 'query'), grievancesController.listGrievances);

// GET /api/grievances/:id
router.get('/:id', grievancesController.getGrievance);

// ─── Status Updates (ADMIN+ only) ───────────────────────────────────────────

// PATCH /api/grievances/:id/status
router.patch(
  '/:id/status',
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  validate(updateStatusSchema),
  grievancesController.updateStatus
);

// ─── Assignment (ADMIN+ only) ───────────────────────────────────────────────

// POST /api/grievances/:id/assign
router.post(
  '/:id/assign',
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  validate(assignGrievanceSchema),
  grievancesController.assignGrievance
);

// ─── Updates (any authenticated user) ───────────────────────────────────────

// POST /api/grievances/:id/updates
router.post(
  '/:id/updates',
  validate(addUpdateSchema),
  grievancesController.addUpdate
);

export default router;