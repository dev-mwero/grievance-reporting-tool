import { after } from "next/server";
import { Role } from "@/types";
import { ApiError } from "../api-error";
import { sendGrievanceSubmittedEmail } from "../email";
import { Grievance } from "../models/grievance.model";
import { GrievanceCategory } from "../models/grievance-category.model";
import { GrievanceUpdate } from "../models/grievance-update.model";
import { SubCounty } from "../models/sub-county.model";
import { User } from "../models/user.model";
import { Ward } from "../models/ward.model";
import { sanitizeRichText } from "../sanitize";
import { AuditAction } from "./audit.service";
import { logGrievanceEvent } from "./audit-impl";
import { createNotifications } from "./notification.service";

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

  await notifyAdminsOfSubmission(grievance._id.toString(), grievance);

  return {
    referenceCode: grievance.referenceCode,
    submittedAt: grievance.submittedAt,
    status: grievance.status,
    subCountyName: grievance.subCountyName,
    wardName: grievance.wardName,
    categoryName: grievance.categoryName,
  };
}

/**
 * Safety valve on how many administrators a single submission can notify.
 * The endpoint is anonymous, so a compromised or over-provisioned admin list
 * must not turn one request into an unbounded mail blast.
 */
const MAX_NOTIFIED_ADMINS = 50;

/**
 * Tell every active administrator about a new grievance, in-app and by email.
 *
 * The in-app rows are awaited so triage does not depend on the mail path
 * working; only the email is deferred, to keep SMTP latency off the public
 * submission response.
 */
async function notifyAdminsOfSubmission(
  grievanceId: string,
  grievance: {
    referenceCode: string;
    categoryName: string;
    subCountyName: string;
    wardName: string;
  },
) {
  const admins = await User.find({
    role: { $in: [Role.ADMIN, Role.SUPER_ADMIN] },
    isActive: true,
  })
    .select("email")
    // SUPER_ADMIN sorts above ADMIN descending, so if the cap truncates the
    // list the accounts that can always triage are the ones retained.
    .sort({ role: -1, createdAt: 1 })
    .limit(MAX_NOTIFIED_ADMINS)
    .lean();

  if (admins.length === 0) return;

  if (admins.length === MAX_NOTIFIED_ADMINS) {
    const total = await User.countDocuments({
      role: { $in: [Role.ADMIN, Role.SUPER_ADMIN] },
      isActive: true,
    });
    if (total > MAX_NOTIFIED_ADMINS) {
      console.warn(
        `[NOTIFY] Submission ${grievance.referenceCode}: notifying ${MAX_NOTIFIED_ADMINS} of ${total} active administrators`,
      );
    }
  }

  await createNotifications(
    admins.map((admin) => ({
      recipientId: admin._id.toString(),
      type: "GRIEVANCE_SUBMITTED" as const,
      title: `New grievance ${grievance.referenceCode}`,
      message: `${grievance.categoryName} · ${grievance.wardName}, ${grievance.subCountyName} — awaiting triage`,
      grievanceId,
      referenceCode: grievance.referenceCode,
    })),
  );

  const ctx = { grievanceId, ...grievance };

  after(async () => {
    for (const admin of admins) {
      await sendGrievanceSubmittedEmail(admin.email, ctx);
    }
  });
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
