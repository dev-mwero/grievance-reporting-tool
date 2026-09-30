import mongoose from "mongoose";
import { after } from "next/server";
import { canTransition, GrievanceStatus } from "@/types";
import { ApiError } from "../api-error";
import { sendGrievanceAssignedEmail } from "../email";
import { Grievance, type IGrievance } from "../models/grievance.model";
import { GrievanceAssignment } from "../models/grievance-assignment.model";
import { GrievanceCategory } from "../models/grievance-category.model";
import { GrievanceUpdate, UpdateType } from "../models/grievance-update.model";
import { Notification } from "../models/notification.model";
import { type DeletionScope, deletionFilter } from "../models/soft-delete";
import { SubCounty } from "../models/sub-county.model";
import { User } from "../models/user.model";
import { Ward } from "../models/ward.model";
import { sanitizeRichText } from "../sanitize";
import { AuditAction } from "./audit.service";
import { logGrievanceEvent } from "./audit-impl";
import {
  type DeletionActor,
  type DeletionHooks,
  type DeletionTarget,
  purgeRecord,
  restoreRecord,
  softDeleteRecord,
} from "./deletion.service";
import { createNotifications } from "./notification.service";

// ─── List Grievances ────────────────────────────────────────────────────────

export async function listGrievances(query: {
  page: number;
  limit: number;
  status?: string;
  subCountyId?: string;
  wardId?: string;
  categoryId?: string;
  assigneeId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  deletionScope?: DeletionScope;
}) {
  const {
    page,
    limit,
    status,
    subCountyId,
    wardId,
    categoryId,
    assigneeId,
    search,
    dateFrom,
    dateTo,
    deletionScope,
  } = query;

  const filter: Record<string, unknown> = { ...deletionFilter(deletionScope) };

  if (status) filter.status = status;
  if (subCountyId) filter.subCountyId = subCountyId;
  if (wardId) filter.wardId = wardId;
  if (categoryId) filter.categoryId = categoryId;

  if (assigneeId) {
    filter.$or = [
      { primaryAssigneeId: assigneeId },
      { supportingAssignees: assigneeId },
    ];
  }

  if (search) {
    filter.$and = filter.$and || [];
    (filter.$and as unknown[]).push({
      $or: [
        { referenceCode: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ],
    });
  }

  if (dateFrom || dateTo) {
    filter.submittedAt = {};
    if (dateFrom)
      (filter.submittedAt as Record<string, unknown>).$gte = new Date(dateFrom);
    if (dateTo)
      (filter.submittedAt as Record<string, unknown>).$lte = new Date(dateTo);
  }

  const [grievances, total] = await Promise.all([
    Grievance.find(filter)
      .populate("categoryId", "name")
      .populate("primaryAssigneeId", "name email")
      .populate("deletedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Grievance.countDocuments(filter),
  ]);

  return {
    grievances,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ─── Get Grievance Detail ───────────────────────────────────────────────────

export async function getGrievanceById(
  grievanceId: string,
  { includeDeleted = false }: { includeDeleted?: boolean } = {},
) {
  const grievance = await Grievance.findOne({
    _id: grievanceId,
    ...(includeDeleted ? {} : deletionFilter()),
  })
    .populate("subCountyId", "name code")
    .populate("wardId", "name code")
    .populate("categoryId", "name description")
    .populate("primaryAssigneeId", "name email title")
    .populate("deletedBy", "name email");

  if (!grievance) {
    throw ApiError.notFound("Grievance not found");
  }

  const updates = await GrievanceUpdate.find({ grievanceId })
    .populate("authorId", "name email")
    .sort({ createdAt: -1 });

  const assignments = await GrievanceAssignment.find({
    grievanceId,
    removedAt: { $exists: false },
  })
    .populate("assigneeId", "name email title")
    .populate("assignedBy", "name email")
    .sort({ assignedAt: -1 });

  return { grievance, updates, assignments };
}

// ─── Admin Edit ─────────────────────────────────────────────────────────────

/**
 * Amend a submitted grievance. The public submission endpoint is anonymous
 * and immutable, so this exists for admins correcting misfiled complaints.
 *
 * The denormalised `subCountyName` / `wardName` / `categoryName` snapshots are
 * re-derived on every relevant change — they are what keeps historical
 * complaints readable after their category or ward is later removed.
 */
export async function updateGrievance(
  grievanceId: string,
  input: {
    subCountyId?: string;
    wardId?: string;
    categoryId?: string;
    description?: string;
  },
  userId: string,
  userName: string,
) {
  const grievance = await Grievance.findById(grievanceId);
  if (!grievance) {
    throw ApiError.notFound("Grievance not found");
  }

  if (grievance.deletedAt) {
    throw ApiError.badRequest(
      "Cannot edit a deleted grievance — restore it first",
    );
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};

  if (input.subCountyId || input.wardId) {
    const subCountyId = input.subCountyId ?? grievance.subCountyId.toString();
    const subCounty = await SubCounty.findById(subCountyId);
    if (!subCounty) {
      throw ApiError.badRequest("Sub-County not found");
    }

    const wardId = input.wardId ?? grievance.wardId.toString();
    const ward = await Ward.findById(wardId);
    if (!ward) {
      throw ApiError.badRequest("Ward not found");
    }
    if (ward.subCountyId.toString() !== subCountyId) {
      throw ApiError.badRequest(
        "Ward does not belong to the selected Sub-County",
      );
    }

    if (input.subCountyId) {
      changes.subCountyId = {
        from: grievance.subCountyName,
        to: subCounty.name,
      };
      grievance.subCountyId = subCounty._id;
      grievance.subCountyName = subCounty.name;
    }

    if (input.wardId) {
      changes.wardId = { from: grievance.wardName, to: ward.name };
      grievance.wardId = ward._id;
      grievance.wardName = ward.name;
    }
  }

  if (input.categoryId) {
    const category = await GrievanceCategory.findById(input.categoryId);
    if (!category) {
      throw ApiError.badRequest("Category not found");
    }
    changes.categoryId = {
      from: grievance.categoryName,
      to: category.name,
    };
    grievance.categoryId = category._id;
    grievance.categoryName = category.name;
  }

  if (
    input.description !== undefined &&
    input.description !== grievance.description
  ) {
    grievance.description = sanitizeRichText(input.description);
    changes.description = { from: "original", to: "amended" };
  }

  await grievance.save();

  await logGrievanceEvent(
    AuditAction.GRIEVANCE_UPDATED,
    grievanceId,
    userId,
    userName,
    { changes },
  );

  return grievance;
}

// ─── Update Status ──────────────────────────────────────────────────────────

export async function updateStatus(
  grievanceId: string,
  input: { status: GrievanceStatus; note?: string },
  userId: string,
  userName: string,
) {
  const grievance = await Grievance.findById(grievanceId);
  if (!grievance) {
    throw ApiError.notFound("Grievance not found");
  }
  if (grievance.deletedAt) {
    throw ApiError.badRequest(
      "Cannot change the status of a deleted grievance — restore it first",
    );
  }

  if (!canTransition(grievance.status, input.status)) {
    throw ApiError.badRequest(
      `Cannot transition from ${grievance.status} to ${input.status}`,
    );
  }

  const previousStatus = grievance.status;
  grievance.status = input.status;

  const now = new Date();
  switch (input.status) {
    case "ACKNOWLEDGED":
      grievance.acknowledgedAt = now;
      break;
    case "RESOLVED":
      grievance.resolvedAt = now;
      break;
    case "CLOSED":
      grievance.closedAt = now;
      break;
  }

  // Each stamp describes how long the case spent in that state, so it is only
  // meaningful while the case is actually in it. Reopening a resolved or closed
  // case must clear it, or `getAvgResolutionDays` keeps measuring a case that
  // is open again.
  if (input.status !== GrievanceStatus.RESOLVED) {
    grievance.resolvedAt = undefined;
  }
  if (input.status !== GrievanceStatus.CLOSED) {
    grievance.closedAt = undefined;
  }

  await grievance.save();

  await GrievanceUpdate.create({
    grievanceId,
    type: UpdateType.PUBLIC_UPDATE,
    content: input.note || `Status changed to ${input.status}`,
    authorId: userId,
    authorName: userName,
  });

  const actionMap: Record<string, AuditAction> = {
    ACKNOWLEDGED: AuditAction.GRIEVANCE_ACKNOWLEDGED,
    RESOLVED: AuditAction.GRIEVANCE_RESOLVED,
    CLOSED: AuditAction.GRIEVANCE_CLOSED,
    REJECTED: AuditAction.GRIEVANCE_REJECTED,
  };
  await logGrievanceEvent(
    actionMap[input.status] || AuditAction.GRIEVANCE_STATUS_CHANGED,
    grievanceId,
    userId,
    userName,
    { from: previousStatus, to: input.status },
  );

  if (grievance.primaryAssigneeId) {
    await createNotifications([
      {
        recipientId: grievance.primaryAssigneeId.toString(),
        type: "GRIEVANCE_STATUS_CHANGED",
        title: `Grievance ${grievance.referenceCode} status updated`,
        message: `Status changed from ${previousStatus} to ${input.status}`,
        grievanceId: grievance._id.toString(),
        referenceCode: grievance.referenceCode,
      },
    ]);
  }

  return grievance;
}

// ─── Assign Grievance ───────────────────────────────────────────────────────

export async function assignGrievance(
  grievanceId: string,
  input: { primaryAssigneeId: string; supportingAssigneeIds: string[] },
  assignedById: string,
  assignedByName: string,
) {
  const grievance = await Grievance.findById(grievanceId);
  if (!grievance) {
    throw ApiError.notFound("Grievance not found");
  }
  if (grievance.deletedAt) {
    throw ApiError.badRequest(
      "Cannot assign a deleted grievance — restore it first",
    );
  }

  const primaryUser = await User.findById(input.primaryAssigneeId);
  if (!primaryUser) {
    throw ApiError.badRequest("Primary assignee not found");
  }

  const supportingUsers =
    input.supportingAssigneeIds.length > 0
      ? await User.find({ _id: { $in: input.supportingAssigneeIds } })
      : [];
  if (supportingUsers.length !== input.supportingAssigneeIds.length) {
    throw ApiError.badRequest("One or more supporting assignees not found");
  }

  await GrievanceAssignment.updateMany(
    { grievanceId, removedAt: { $exists: false } },
    { removedAt: new Date() },
  );

  await GrievanceAssignment.create({
    grievanceId,
    assigneeId: input.primaryAssigneeId,
    assigneeName: primaryUser.name,
    assignedBy: assignedById,
    assignedByName,
    isPrimary: true,
    assignedAt: new Date(),
  });

  for (const supportUser of supportingUsers) {
    await GrievanceAssignment.create({
      grievanceId,
      assigneeId: supportUser._id.toString(),
      assigneeName: supportUser.name,
      assignedBy: assignedById,
      assignedByName,
      isPrimary: false,
      assignedAt: new Date(),
    });
  }

  grievance.primaryAssigneeId = new mongoose.Types.ObjectId(
    input.primaryAssigneeId,
  );
  grievance.supportingAssignees = input.supportingAssigneeIds.map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  // Assignment implies the case is now ASSIGNED. The transition table has no
  // SUBMITTED → ASSIGNED edge, so this is deliberately a widening of the graph
  // rather than an ordinary transition — hence the explicit status list instead
  // of canTransition(), which would reject it. The two enforcers must agree, or
  // the status dropdown and the assign button will disagree about what is
  // reachable.
  const autoAssignable: GrievanceStatus[] = [
    GrievanceStatus.SUBMITTED,
    GrievanceStatus.ACKNOWLEDGED,
    GrievanceStatus.UNDER_REVIEW,
  ];
  const statusBeforeAssignment = grievance.status;
  if (autoAssignable.includes(grievance.status)) {
    grievance.status = GrievanceStatus.ASSIGNED;
  }

  await grievance.save();

  await GrievanceUpdate.create({
    grievanceId,
    type: UpdateType.INTERNAL_NOTE,
    content:
      `Assigned to ${primaryUser.name}` +
      (input.supportingAssigneeIds.length > 0
        ? ` with ${input.supportingAssigneeIds.length} supporting assignee(s)`
        : ""),
    authorId: assignedById,
    authorName: assignedByName,
  });

  await logGrievanceEvent(
    AuditAction.GRIEVANCE_ASSIGNED,
    grievanceId,
    assignedById,
    assignedByName,
    {
      primaryAssigneeId: input.primaryAssigneeId,
      supportingAssigneeIds: input.supportingAssigneeIds,
      // Recorded because assignment can move the case as a side effect; without
      // this the status change would be invisible in the audit trail.
      ...(statusBeforeAssignment !== grievance.status
        ? {
            statusFrom: statusBeforeAssignment,
            statusTo: grievance.status,
          }
        : {}),
    },
  );

  const assigneeIds = [input.primaryAssigneeId, ...input.supportingAssigneeIds];
  await createNotifications(
    assigneeIds.map((assigneeId) => ({
      recipientId: assigneeId,
      type: "GRIEVANCE_ASSIGNED" as const,
      title: `Grievance ${grievance.referenceCode} assigned to you`,
      message: `You have been assigned to grievance ${grievance.referenceCode} by ${assignedByName}`,
      grievanceId: grievance._id.toString(),
      referenceCode: grievance.referenceCode,
    })),
  );

  const emailCtx = {
    grievanceId: grievance._id.toString(),
    referenceCode: grievance.referenceCode,
    categoryName: grievance.categoryName,
    subCountyName: grievance.subCountyName,
    wardName: grievance.wardName,
    assignedByName,
  };

  const recipients: Array<{ email: string; isPrimary: boolean }> = [
    { email: primaryUser.email, isPrimary: true },
  ];
  for (const supportUser of supportingUsers) {
    if (supportUser.email !== primaryUser.email) {
      recipients.push({ email: supportUser.email, isPrimary: false });
    }
  }

  // Deferred so SMTP latency does not hold up the admin's assign action.
  after(async () => {
    for (const recipient of recipients) {
      await sendGrievanceAssignedEmail(recipient.email, {
        ...emailCtx,
        isPrimary: recipient.isPrimary,
      });
    }
  });

  return grievance;
}

// ─── Add Update ─────────────────────────────────────────────────────────────

export async function addUpdate(
  grievanceId: string,
  input: { type: "PUBLIC_UPDATE" | "INTERNAL_NOTE"; content: string },
  userId: string,
  userName: string,
) {
  const grievance = await Grievance.findById(grievanceId);
  if (!grievance) {
    throw ApiError.notFound("Grievance not found");
  }
  if (grievance.deletedAt) {
    throw ApiError.badRequest(
      "Cannot add updates to a deleted grievance — restore it first",
    );
  }

  const update = await GrievanceUpdate.create({
    grievanceId,
    type: input.type,
    content: input.content,
    authorId: userId,
    authorName: userName,
  });

  await logGrievanceEvent(
    input.type === UpdateType.PUBLIC_UPDATE
      ? AuditAction.PUBLIC_UPDATE_ADDED
      : AuditAction.INTERNAL_NOTE_ADDED,
    grievanceId,
    userId,
    userName,
  );

  return update;
}

// ─── Soft Delete / Restore / Purge ──────────────────────────────────────────

const grievanceTarget: DeletionTarget<IGrievance> = {
  label: "Grievance",
  entityType: "Grievance",
  model: Grievance,
};

const grievanceActions = {
  softDelete: AuditAction.GRIEVANCE_SOFT_DELETED,
  restore: AuditAction.GRIEVANCE_RESTORED,
  purge: AuditAction.GRIEVANCE_PURGED,
};

const grievanceHooks: DeletionHooks<IGrievance> = {
  // Updates, assignments and notifications have no meaning without the
  // grievance they describe, so a purge takes them with it. A soft delete
  // keeps everything intact and simply hides the complaint from every read.
  cascadePurge: async (doc) => {
    const grievanceId = doc._id;
    await GrievanceUpdate.deleteMany({ grievanceId });
    await GrievanceAssignment.deleteMany({ grievanceId });
    await Notification.deleteMany({ grievanceId });
  },
  metadata: (doc) => ({
    referenceCode: doc.referenceCode,
    status: doc.status,
    categoryName: doc.categoryName,
  }),
};

export async function softDeleteGrievance(
  grievanceId: string,
  actor: DeletionActor,
  reason?: string,
) {
  return softDeleteRecord(
    grievanceTarget,
    grievanceActions,
    grievanceId,
    actor,
    grievanceHooks,
    reason,
  );
}

export async function restoreGrievance(
  grievanceId: string,
  actor: DeletionActor,
) {
  return restoreRecord(
    grievanceTarget,
    grievanceActions,
    grievanceId,
    actor,
    grievanceHooks,
  );
}

export async function purgeGrievance(
  grievanceId: string,
  actor: DeletionActor,
) {
  return purgeRecord(
    grievanceTarget,
    grievanceActions,
    grievanceId,
    actor,
    grievanceHooks,
  );
}

// ─── Get Staff Dashboard Stats ──────────────────────────────────────────────

export async function getDashboardStats(userId: string) {
  const notDeletedFilter = deletionFilter();
  const [myAssigned, totalOpen, recentUpdates] = await Promise.all([
    Grievance.countDocuments({
      ...notDeletedFilter,
      primaryAssigneeId: userId,
      status: { $nin: ["CLOSED", "REJECTED"] },
    }),
    Grievance.countDocuments({
      ...notDeletedFilter,
      status: { $nin: ["CLOSED", "REJECTED"] },
    }),
    GrievanceUpdate.find({ authorId: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("grievanceId", "referenceCode status"),
  ]);

  return { myAssigned, totalOpen, recentActivity: recentUpdates };
}
