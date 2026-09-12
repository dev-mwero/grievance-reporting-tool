import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { uploadSingle } from '../../middleware/upload';
import { Role } from 'shared';
import { listAttachmentsQuerySchema } from './attachments.validation';
import * as attachmentsController from './attachments.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── Attachments for a Grievance ────────────────────────────────────────────

// POST /api/grievances/:id/attachments (upload single file)
router.post(
  '/:id/attachments',
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  uploadSingle,
  attachmentsController.uploadAttachment
);

// GET /api/grievances/:id/attachments
router.get(
  '/:id/attachments',
  validate(listAttachmentsQuerySchema, 'query'),
  attachmentsController.listAttachments
);

// GET /api/grievances/:id/attachments/:attachmentId
router.get('/:id/attachments/:attachmentId', attachmentsController.getAttachment);

// DELETE /api/grievances/:id/attachments/:attachmentId
router.delete(
  '/:id/attachments/:attachmentId',
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  attachmentsController.deleteAttachment
);

export default router;