import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  acceptInvitationSchema,
  changePasswordSchema,
} from './auth.validation';
import * as authController from './auth.controller';

const router = Router();

// ─── Public Routes ──────────────────────────────────────────────────────────

// POST /api/auth/login
router.post('/login', validate(loginSchema), authController.login);

// POST /api/auth/refresh
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

// POST /api/auth/forgot-password
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

// POST /api/auth/accept-invitation
router.post(
  '/accept-invitation',
  validate(acceptInvitationSchema),
  authController.acceptInvitation
);

// ─── Protected Routes ───────────────────────────────────────────────────────

// GET /api/auth/profile
router.get('/profile', authenticate, authController.getProfile);

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

export default router;
