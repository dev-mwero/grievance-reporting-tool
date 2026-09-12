import mongoose from "mongoose";
import { canTransition, type GrievanceStatus } from "@/types";
import { ApiError } from "../api-error";
import { Grievance } from "../models/grievance.model";
import { GrievanceAssignment } from "../models/grievance-assignment.model";
import { GrievanceUpdate, UpdateType } from "../models/grievance-update.model";
import { User } from "../models/user.model";
import { AuditAction } from "./audit.service";
import { logGrievanceEvent } from "./audit-impl";
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
  } = query;

  const filter: Record<string, unknown> = {};

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

export async function getGrievanceById(grievanceId: string) {
  const grievance = await Grievance.findById(grievanceId)
    .populate("subCountyId", "name code")
    .populate("wardId", "name code")
    .populate("categoryId", "name description")
    .populate("primaryAssigneeId", "name email title");

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

  const primaryUser = await User.findById(input.primaryAssigneeId);
  if (!primaryUser) {
    throw ApiError.badRequest("Primary assignee not found");
  }

  if (input.supportingAssigneeIds.length > 0) {
    const supportingUsers = await User.find({
      _id: { $in: input.supportingAssigneeIds },
    });
    if (supportingUsers.length !== input.supportingAssigneeIds.length) {
      throw ApiError.badRequest("One or more supporting assignees not found");
    }
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

  for (const supportId of input.supportingAssigneeIds) {
    const supportUser = await User.findById(supportId);
    if (supportUser) {
      await GrievanceAssignment.create({
        grievanceId,
        assigneeId: supportId,
        assigneeName: supportUser.name,
        assignedBy: assignedById,
        assignedByName,
        isPrimary: false,
        assignedAt: new Date(),
      });
    }
  }

  grievance.primaryAssigneeId = new mongoose.Types.ObjectId(
    input.primaryAssigneeId,
  );
  grievance.supportingAssignees = input.supportingAssigneeIds.map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  if (
    ["SUBMITTED", "ACKNOWLEDGED", "UNDER_REVIEW"].includes(grievance.status)
  ) {
    grievance.status = "ASSIGNED" as GrievanceStatus;
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

// ─── Get Staff Dashboard Stats ──────────────────────────────────────────────

export async function getDashboardStats(userId: string) {
  const [myAssigned, totalOpen, recentUpdates] = await Promise.all([
    Grievance.countDocuments({
      primaryAssigneeId: userId,
      status: { $nin: ["CLOSED", "REJECTED"] },
    }),
    Grievance.countDocuments({
      status: { $nin: ["CLOSED", "REJECTED"] },
    }),
    GrievanceUpdate.find({ authorId: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("grievanceId", "referenceCode status"),
  ]);

  return { myAssigned, totalOpen, recentActivity: recentUpdates };
}
