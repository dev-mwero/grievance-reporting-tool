import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { Role } from 'shared';
import {
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  createInvitationSchema,
  listInvitationsQuerySchema,
} from './users.validation';
import * as usersController from './users.controller';

const router = Router();

// All routes require authentication and ADMIN role or higher
router.use(authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN));

// ─── Invitations (must come before /:id routes) ─────────────────────────────

// GET /api/admin/users/invitations
router.get(
  '/invitations',
  validate(listInvitationsQuerySchema, 'query'),
  usersController.listInvitations
);

// POST /api/admin/users/invitations
router.post('/invitations', validate(createInvitationSchema), usersController.createInvitation);

// POST /api/admin/users/invitations/:id/resend
router.post('/invitations/:id/resend', usersController.resendInvitation);

// DELETE /api/admin/users/invitations/:id
router.delete('/invitations/:id', usersController.revokeInvitation);

// ─── Users ──────────────────────────────────────────────────────────────────

// GET /api/admin/users
router.get('/', validate(listUsersQuerySchema, 'query'), usersController.listUsers);

// GET /api/admin/users/:id
router.get('/:id', usersController.getUser);

// POST /api/admin/users
router.post('/', validate(createUserSchema), usersController.createUser);

// PATCH /api/admin/users/:id
router.patch('/:id', validate(updateUserSchema), usersController.updateUser);

// POST /api/admin/users/:id/deactivate
router.post('/:id/deactivate', usersController.deactivateUser);

export default router;
