import { ApiError } from "../api-error";
import { Grievance } from "../models/grievance.model";
import { GrievanceCategory } from "../models/grievance-category.model";
import { GrievanceUpdate } from "../models/grievance-update.model";
import { SubCounty } from "../models/sub-county.model";
import { Ward } from "../models/ward.model";
import { sanitizeRichText } from "../sanitize";
import { AuditAction } from "./audit.service";
import { logGrievanceEvent } from "./audit-impl";

// ─── Lookup Data (Public) ───────────────────────────────────────────────────

export async function getActiveSubCounties() {
  return SubCounty.find({ isActive: true })
    .collation({ locale: "en", strength: 2 })
    .sort({ name: 1 });
}

export async function getActiveWardsBySubCounty(subCountyId: string) {
  const subCounty = await SubCounty.findById(subCountyId);
  if (!subCounty || !subCounty.isActive) {
    throw ApiError.notFound("Sub-County not found");
  }

  return Ward.find({ subCountyId, isActive: true })
    .collation({ locale: "en", strength: 2 })
    .sort({ name: 1 });
}

export async function getActiveCategories() {
  return GrievanceCategory.find({ isActive: true }).sort({ name: 1 });
}

// ─── Public Stats (for landing page) ────────────────────────────────────────

export async function getPublicStats() {
  const [
    totalGrievances,
    resolvedGrievances,
    activeCategories,
    activeSubCounties,
  ] = await Promise.all([
    Grievance.countDocuments(),
    Grievance.countDocuments({ status: { $in: ["RESOLVED", "CLOSED"] } }),
    GrievanceCategory.countDocuments({ isActive: true }),
    SubCounty.countDocuments({ isActive: true }),
  ]);

  return {
    totalGrievances,
    resolvedGrievances,
    activeCategories,
    activeSubCounties,
  };
}

// ─── Submit Grievance ───────────────────────────────────────────────────────

export async function submitGrievance(input: {
  subCountyId: string;
  wardId: string;
  categoryId: string;
  description: string;
}) {
  const subCounty = await SubCounty.findById(input.subCountyId);
  if (!subCounty || !subCounty.isActive) {
    throw ApiError.badRequest("Invalid Sub-County");
  }

  const ward = await Ward.findById(input.wardId);
  if (!ward || !ward.isActive) {
    throw ApiError.badRequest("Invalid Ward");
  }
  if (ward.subCountyId.toString() !== input.subCountyId) {
    throw ApiError.badRequest(
      "Ward does not belong to the selected Sub-County",
    );
  }

  const category = await GrievanceCategory.findById(input.categoryId);
  if (!category || !category.isActive) {
    throw ApiError.badRequest("Invalid Category");
  }

  const sanitizedDescription = sanitizeRichText(input.description);

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

  await logGrievanceEvent(
    AuditAction.GRIEVANCE_SUBMITTED,
    grievance._id.toString(),
    undefined,
    undefined,
    { referenceCode: grievance.referenceCode },
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
    .populate("categoryId", "name description")
    .lean();

  if (!grievance) {
    throw ApiError.notFound("Grievance not found");
  }

  const publicUpdates = await GrievanceUpdate.find({
    grievanceId: grievance._id,
    type: "PUBLIC_UPDATE",
  })
    .sort({ createdAt: 1 })
    .lean();

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
