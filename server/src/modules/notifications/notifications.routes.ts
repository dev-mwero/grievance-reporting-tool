import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { listNotificationsQuerySchema } from './notifications.validation';
import * as notificationsController from './notifications.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/notifications
router.get(
  '/',
  validate(listNotificationsQuerySchema, 'query'),
  notificationsController.list
);

// GET /api/notifications/unread-count
router.get('/unread-count', notificationsController.unreadCount);

// POST /api/notifications/read-all
router.post('/read-all', notificationsController.readAll);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', notificationsController.markRead);

export default router;
