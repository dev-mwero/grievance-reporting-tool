import { SubCounty } from '../../models/sub-county.model';
import { Ward } from '../../models/ward.model';
import { GrievanceCategory } from '../../models/grievance-category.model';
import { Grievance } from '../../models/grievance.model';
import { GrievanceUpdate } from '../../models/grievance-update.model';
import { ApiError } from '../../utils/api-error';
import { logGrievanceEvent } from '../../services/audit-impl';
import { AuditAction } from '../../services/audit.service';
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

export async function submitGrievance(input: SubmitGrievanceInput) {
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

  // Create grievance with snapshot data
  const grievance = await Grievance.create({
    subCountyId: input.subCountyId,
    wardId: input.wardId,
    categoryId: input.categoryId,
    subCountyName: subCounty.name,
    wardName: ward.name,
    categoryName: category.name,
    description: input.description,
    submittedAt: new Date(),
  });

  // Audit log (anonymous submission)
  await logGrievanceEvent(
    AuditAction.GRIEVANCE_SUBMITTED,
    grievance._id.toString(),
    undefined,
    undefined,
    { referenceCode: grievance.referenceCode }
  );

  return {
    referenceCode: grievance.referenceCode,
    submittedAt: grievance.submittedAt,
    status: grievance.status,
    subCountyName: grievance.subCountyName,
    wardName: grievance.wardName,
    categoryName: grievance.categoryName,
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
