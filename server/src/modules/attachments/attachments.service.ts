import { Attachment } from '../../models/attachment.model';
import { Grievance } from '../../models/grievance.model';
import { storageService } from '../../services/storage-impl';
import { logGrievanceEvent } from '../../services/audit-impl';
import { AuditAction } from '../../services/audit.service';
import { ApiError } from '../../utils/api-error';
import type { ListAttachmentsQuery } from './attachments.validation';

// ─── Upload Attachment ──────────────────────────────────────────────────────

export async function uploadAttachment(
  grievanceId: string,
  file: Express.Multer.File,
  uploadedBy?: string
) {
  const grievance = await Grievance.findById(grievanceId);
  if (!grievance) {
    throw ApiError.notFound('Grievance not found');
  }

  // Upload to storage
  const stored = await storageService.upload(
    {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    },
    `grievances/${grievanceId}`
  );

  // Create attachment record
  const attachment = await Attachment.create({
    grievanceId,
    originalName: stored.originalName,
    mimeType: stored.mimeType,
    size: stored.size,
    storageKey: stored.storageKey,
    url: stored.url,
    uploadedBy,
    uploadedAt: new Date(),
  });

  // Audit log
  await logGrievanceEvent(
    AuditAction.ATTACHMENT_ADDED,
    grievanceId,
    uploadedBy,
    undefined,
    { attachmentId: attachment._id.toString(), originalName: attachment.originalName }
  );

  return attachment;
}

// ─── List Attachments for Grievance ─────────────────────────────────────────

export async function listAttachments(grievanceId: string, query: ListAttachmentsQuery) {
  const { page, limit } = query;

  const [attachments, total] = await Promise.all([
    Attachment.find({ grievanceId })
      .sort({ uploadedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Attachment.countDocuments({ grievanceId }),
  ]);

  return {
    attachments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ─── Get Attachment ─────────────────────────────────────────────────────────

export async function getAttachment(attachmentId: string) {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) {
    throw ApiError.notFound('Attachment not found');
  }
  return attachment;
}

// ─── Delete Attachment ──────────────────────────────────────────────────────

export async function deleteAttachment(attachmentId: string) {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment) {
    throw ApiError.notFound('Attachment not found');
  }

  // Delete from storage
  await storageService.delete(attachment.storageKey);

  // Delete record
  await attachment.deleteOne();

  return { message: 'Attachment deleted' };
}