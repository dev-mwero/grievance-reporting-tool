import type { Request, Response } from 'express';
import * as attachmentsService from './attachments.service';
import { getParam } from '../../utils/params';
import type { ListAttachmentsQuery } from './attachments.validation';

// ─── Upload Attachment ──────────────────────────────────────────────────────

export async function uploadAttachment(req: Request, res: Response): Promise<void> {
  const grievanceId = getParam(req, 'id');

  if (!req.file) {
    res.status(400).json({
      success: false,
      message: 'No file uploaded',
    });
    return;
  }

  const attachment = await attachmentsService.uploadAttachment(
    grievanceId,
    req.file,
    req.user?.userId
  );

  res.status(201).json({
    success: true,
    message: 'Attachment uploaded successfully',
    data: attachment,
  });
}

// ─── List Attachments ───────────────────────────────────────────────────────

export async function listAttachments(req: Request, res: Response): Promise<void> {
  const grievanceId = getParam(req, 'id');
  const query = req.validated as unknown as ListAttachmentsQuery;
  const result = await attachmentsService.listAttachments(grievanceId, query);

  res.json({
    success: true,
    data: result.attachments,
    pagination: result.pagination,
  });
}

// ─── Get Attachment ─────────────────────────────────────────────────────────

export async function getAttachment(req: Request, res: Response): Promise<void> {
  const attachment = await attachmentsService.getAttachment(getParam(req, 'attachmentId'));

  res.json({
    success: true,
    data: attachment,
  });
}

// ─── Delete Attachment ──────────────────────────────────────────────────────

export async function deleteAttachment(req: Request, res: Response): Promise<void> {
  const result = await attachmentsService.deleteAttachment(getParam(req, 'attachmentId'));

  res.json({
    success: true,
    message: result.message,
  });
}