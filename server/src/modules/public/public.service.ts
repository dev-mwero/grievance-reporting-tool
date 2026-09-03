import { SubCounty } from '../../models/sub-county.model';
import { Ward } from '../../models/ward.model';
import { GrievanceCategory } from '../../models/grievance-category.model';
import { Grievance } from '../../models/grievance.model';
import { GrievanceUpdate } from '../../models/grievance-update.model';
import { Attachment } from '../../models/attachment.model';
import { storageService } from '../../services/storage-impl';
import { ApiError } from '../../utils/api-error';
import { logGrievanceEvent } from '../../services/audit-impl';
import { AuditAction } from '../../services/audit.service';
import sanitizeHtml from 'sanitize-html';
import type { SubmitGrievanceInput } from './public.validation';

// ─── Lookup Data (Public) ───────────────────────────────────────────────────

export async function getActiveSubCounties() {
  return SubCounty.find({ isActive: true }).sort({ name: 1 });
}

export async function getActiveWardsBySubCounty(subCountyId: string) {
  const subCounty = await SubCounty.findById(subCountyId);
  if (!subCounty || !subCounty.isActive) {
    throw ApiError.notFound('Sub-County not found');
  }

  return Ward.find({ subCountyId, isActive: true }).sort({ name: 1 });
}

export async function getActiveCategories() {
  return GrievanceCategory.find({ isActive: true }).sort({ name: 1 });
}

// ─── Submit Grievance ───────────────────────────────────────────────────────

/**
 * Allowed HTML tags for rich text descriptions.
 * Basic formatting only: bold, italic, underline, lists, links, headings.
 */
const ALLOWED_HTML_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4',
  'blockquote', 'code', 'pre',
];

const ALLOWED_HTML_ATTRIBUTES = {
  a: ['href', 'target', 'rel'],
};

export async function submitGrievance(
  input: SubmitGrievanceInput,
  files: Express.Multer.File[] = []
) {
  // Validate sub-county exists and is active
  const subCounty = await SubCounty.findById(input.subCountyId);
  if (!subCounty || !subCounty.isActive) {
    throw ApiError.badRequest('Invalid Sub-County');
  }

  // Validate ward exists, is active, and belongs to the sub-county
  const ward = await Ward.findById(input.wardId);
  if (!ward || !ward.isActive) {
    throw ApiError.badRequest('Invalid Ward');
  }
  if (ward.subCountyId.toString() !== input.subCountyId) {
    throw ApiError.badRequest('Ward does not belong to the selected Sub-County');
  }

  // Validate category exists and is active
  const category = await GrievanceCategory.findById(input.categoryId);
  if (!category || !category.isActive) {
    throw ApiError.badRequest('Invalid Category');
  }

  // Sanitize rich text description to prevent XSS
  const sanitizedDescription = sanitizeHtml(input.description, {
    allowedTags: ALLOWED_HTML_TAGS,
    allowedAttributes: ALLOWED_HTML_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto'],
  });

  // Create grievance with snapshot data
  const grievance = await Grievance.create({
    subCountyId: input.subCountyId,
    wardId: input.wardId,
    categoryId: input.categoryId,
    subCountyName: subCounty.name,
    wardName: ward.name,
    categoryName: category.name,
    description: sanitizedDescription,
    submittedAt: new Date(),
  });

  // Upload attachments (if any) — anonymous uploads (uploadedBy: undefined)
  const uploadedAttachments = [];
  for (const file of files) {
    const stored = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      `grievances/${grievance._id.toString()}`
    );

    const attachment = await Attachment.create({
      grievanceId: grievance._id,
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      size: stored.size,
      storageKey: stored.storageKey,
      url: stored.url,
      // uploadedBy intentionally omitted — anonymous public submission
      uploadedAt: new Date(),
    });

    uploadedAttachments.push(attachment);
  }

  // Audit log (anonymous submission)
  await logGrievanceEvent(
    AuditAction.GRIEVANCE_SUBMITTED,
    grievance._id.toString(),
    undefined,
    undefined,
    {
      referenceCode: grievance.referenceCode,
      attachmentCount: uploadedAttachments.length,
    }
  );

  return {
    referenceCode: grievance.referenceCode,
    submittedAt: grievance.submittedAt,
    status: grievance.status,
    subCountyName: grievance.subCountyName,
    wardName: grievance.wardName,
    categoryName: grievance.categoryName,
    attachmentCount: uploadedAttachments.length,
  };
}

// ─── Track Grievance by Reference Code ──────────────────────────────────────

export async function trackByReferenceCode(referenceCode: string) {
  const grievance = await Grievance.findOne({ referenceCode })
    .populate('categoryId', 'name description')
    .lean();

  if (!grievance) {
    throw ApiError.notFound('Grievance not found');
  }

  // Fetch public updates only (internal notes are never exposed to the public)
  const publicUpdates = await GrievanceUpdate.find({
    grievanceId: grievance._id,
    type: 'PUBLIC_UPDATE',
  })
    .sort({ createdAt: 1 })
    .lean();

  // Return limited information to the public
  return {
    referenceCode: grievance.referenceCode,
    status: grievance.status,
    subCountyName: grievance.subCountyName,
    wardName: grievance.wardName,
    categoryName: grievance.categoryName,
    description: grievance.description,
    submittedAt: grievance.submittedAt,
    acknowledgedAt: grievance.acknowledgedAt,
    resolvedAt: grievance.resolvedAt,
    closedAt: grievance.closedAt,
    updates: publicUpdates.map((u) => ({
      _id: u._id,
      content: u.content,
      authorName: u.authorName,
      createdAt: u.createdAt,
    })),
  };
}
