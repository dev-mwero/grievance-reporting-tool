import mongoose from "mongoose";
import { after } from "next/server";
import { Role } from "@/types";
import { ApiError } from "../api-error";
import { sendGrievanceAssignedEmail } from "../email";
import { Attachment } from "../models/attachment.model";
import { Grievance, type IGrievance } from "../models/grievance.model";
import { GrievanceAssignment } from "../models/grievance-assignment.model";
import { GrievanceCategory } from "../models/grievance-category.model";
import { GrievanceUpdate, UpdateType } from "../models/grievance-update.model";
import { Notification } from "../models/notification.model";
import { type DeletionScope, deletionFilter } from "../models/soft-delete";
import { SubCounty } from "../models/sub-county.model";
import { User } from "../models/user.model";
import { Ward } from "../models/ward.model";
import { type IWorkflow, Workflow } from "../models/workflow.model";
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
import { supersedeForGrievance } from "./transition-requests.service";
import { availableTransitions } from "./workflow-graph";
import {
  loadStageLabels,
  resolveWorkflowForCategory,
  toGraph,
  withStage,
} from "./workflows.service";

function isAdminRole(role: string): boolean {
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

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

  const [grievances, total, labels] = await Promise.all([
    Grievance.find(filter)
      .populate("categoryId", "name")
      .populate("primaryAssigneeId", "name email")
      .populate("deletedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Grievance.countDocuments(filter),
    loadStageLabels(),
  ]);

  return {
    // Stages ride along with each row so a renamed stage displays its new name
    // here too, not just in the workflow builder. One lookup for the page.
    grievances: withStage(
      grievances.map((g) => g.toObject()),
      labels,
    ),
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

  const [labels] = await Promise.all([loadStageLabels()]);

  return {
    grievance: withStage([grievance.toObject()], labels)[0],
    updates,
    assignments,
  };
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
  input: { status: string; note?: string },
  userId: string,
  userName: string,
  role: string,
  { exceptRequestId }: { exceptRequestId?: string } = {},
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

  const workflow = await loadWorkflowForGrievance(grievance);
  const graph = toGraph(workflow);
  const target = input.status;

  // Staff act on complaints they are working on. Without this check, opening the
  // route to staff would let any staff member move any complaint in the system
  // just by knowing its id.
  if (!isAdminRole(role)) {
    const assigned =
      grievance.primaryAssigneeId?.toString() === userId ||
      grievance.supportingAssignees.some((id) => id.toString() === userId);
    if (!assigned) {
      throw ApiError.forbidden("You can only move complaints assigned to you");
    }
  }

  if (!graph.stages.some((s) => s.key === target)) {
    throw ApiError.badRequest(
      `"${target}" is not a stage of this complaint's workflow`,
    );
  }

  // The workflow, not a hardcoded table, decides what is reachable. Distinguish
  // the three ways this can fail, because the remedy differs: the move may not
  // exist at all, may exist but be closed to this role, or may need an admin's
  // sign-off before anyone else can take it.
  const configured = graph.transitions.find(
    (t) => t.from === grievance.status && t.to === target,
  );

  if (!configured) {
    throw ApiError.badRequest(
      `No move from "${grievance.status}" to "${target}" is defined in this workflow`,
    );
  }

  const roleAllows =
    isAdminRole(role) || configured.allowedRoles.includes(role);

  // A reopen is admin-only. Admins are the escalation path, so the restriction
  // never applies to them — it only stops staff reviving a closed complaint.
  if (!roleAllows || (configured.isReopen && !isAdminRole(role))) {
    throw ApiError.forbidden("You do not have permission to make that move");
  }

  // A move configured to need approval cannot be taken directly by staff; it has
  // to be proposed. Until proposals exist it is refused rather than silently
  // applied, so the approval requirement cannot be bypassed.
  if (!isAdminRole(role) && configured.requiresApproval) {
    throw ApiError.forbidden(
      `"${configured.actionLabel}" needs an admin's approval — it cannot be applied directly`,
    );
  }

  const reason = input.note?.trim();
  if (configured.requiresReason && !reason) {
    throw ApiError.badRequest(`"${configured.actionLabel}" requires a reason`);
  }

  // A move configured to need evidence cannot proceed on a note alone. Checked
  // here, at the single point every move passes through, because the flag is a
  // property of the edge rather than of the UI: an admin applying the move
  // directly and an approval being granted are both just calls to this
  // function, so enforcing it anywhere else would leave a way around it.
  if (configured.requiresAttachment) {
    const evidence = await Attachment.countDocuments({
      grievanceId: grievance._id,
    });
    if (evidence === 0) {
      throw ApiError.badRequest(
        `"${configured.actionLabel}" requires at least one attachment as evidence`,
      );
    }
  }

  const previousStatus = grievance.status;
  grievance.status = target;

  const now = new Date();
  const nowFinal = graph.stages.find((s) => s.key === target)?.isFinal === true;

  // Legacy timestamps still drive resolution metrics, so they follow the
  // workflow rather than the old hardcoded enum. Each stamp belongs to exactly
  // one state and is only meaningful while the complaint is in it — so the stamp
  // is cleared whenever it leaves. Getting this wrong makes duration metrics
  // count a reopened case as still resolved.
  //
  //   resolvedAt — set on entering RESOLVED, cleared on leaving it
  //   closedAt   — set on entering any final stage, cleared on leaving one
  if (target === "RESOLVED") {
    grievance.resolvedAt = now;
  } else {
    grievance.resolvedAt = undefined;
  }

  if (nowFinal) {
    grievance.closedAt = now;
  } else {
    grievance.closedAt = undefined;
  }

  await grievance.save();

  const fromLabel = labelForStage(graph, previousStatus);
  const toLabel = labelForStage(graph, target);

  await GrievanceUpdate.create({
    grievanceId,
    type: UpdateType.PUBLIC_UPDATE,
    content: reason || `Status changed to ${toLabel}`,
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
    actionMap[target] || AuditAction.GRIEVANCE_STATUS_CHANGED,
    grievanceId,
    userId,
    userName,
    { from: previousStatus, to: target },
  );

  if (grievance.primaryAssigneeId) {
    await createNotifications([
      {
        recipientId: grievance.primaryAssigneeId.toString(),
        type: "GRIEVANCE_STATUS_CHANGED",
        title: `Grievance ${grievance.referenceCode} status updated`,
        message: `Status changed from ${fromLabel} to ${toLabel}`,
        grievanceId: grievance._id.toString(),
        referenceCode: grievance.referenceCode,
      },
    ]);
  }

  // A complaint that just moved on cannot also be the subject of a pending
  // proposal from its old stage. Close those out, or the approval queue offers an
  // admin a move the complaint is no longer eligible for.
  await supersedeForGrievance(grievanceId, exceptRequestId);

  return grievance;
}

/**
 * The moves this actor can take on this complaint right now.
 *
 * Returned by the server rather than recomputed in the browser: the same
 * `availableTransitions` call that authorises a move is what renders the
 * buttons, so the UI cannot offer something the service would then refuse.
 */
export async function getAvailableMoves(
  grievanceId: string,
  userId: string,
  role: string,
) {
  const grievance = await Grievance.findById(grievanceId);
  if (!grievance || grievance.deletedAt) {
    throw ApiError.notFound("Grievance not found");
  }

  const graph = toGraph(await loadWorkflowForGrievance(grievance));
  const label = (key: string) =>
    graph.stages.find((s) => s.key === key)?.label ?? key;

  // Mirror the assignment check in updateStatus. Showing a staff member moves on
  // a complaint they cannot actually move would be offering a dead end.
  if (
    !isAdminRole(role) &&
    grievance.primaryAssigneeId?.toString() !== userId &&
    !grievance.supportingAssignees.some((id) => id.toString() === userId)
  ) {
    return [];
  }

  // Include approval-gated moves: staff cannot apply those, but they must be
  // able to see and propose them. `canApply` is what separates the two, so the
  // UI can offer "Propose" rather than a button that would be refused.
  return availableTransitions(graph, grievance.status, role, {
    includeApprovalGated: true,
  }).map((t) => ({
    to: t.to,
    toLabel: label(t.to),
    actionLabel: t.actionLabel,
    requiresApproval: t.requiresApproval,
    requiresReason: t.requiresReason,
    requiresAttachment: t.requiresAttachment,
    isReopen: t.isReopen === true,
    canApply: isAdminRole(role) || !t.requiresApproval,
  }));
}

/**
 * The workflow governing a complaint. Prefers the one pinned at submission so
 * that editing a workflow cannot change how an existing case is expected to
 * progress; falls back to resolving by category for complaints predating the
 * pin.
 */
async function loadWorkflowForGrievance(
  grievance: IGrievance,
): Promise<IWorkflow> {
  if (grievance.workflowId) {
    const pinned = await Workflow.findById(grievance.workflowId);
    if (pinned) return pinned;
  }

  const categoryId =
    grievance.categoryId && typeof grievance.categoryId !== "string"
      ? String((grievance.categoryId as { _id: unknown })._id)
      : grievance.categoryId
        ? String(grievance.categoryId)
        : null;

  const resolved = await resolveWorkflowForCategory(categoryId);
  if (!resolved) {
    // No active workflow means nothing defines the stages this complaint may sit
    // in. Refusing is the only safe answer: guessing would silently reintroduce
    // a hardcoded cycle and let a case drift somewhere ungoverned.
    throw ApiError.badRequest(
      "No active complaint workflow is configured for this category",
    );
  }
  return resolved;
}

/**
 * Whether the complaint's workflow defines a move into `targetStageKey`. Used by
 * side effects that imply a stage change — assignment — which must not invent a
 * transition the admin never drew.
 */
async function workflowDefinesMove(
  grievance: IGrievance,
  targetStageKey: string,
): Promise<boolean> {
  try {
    const graph = toGraph(await loadWorkflowForGrievance(grievance));
    return graph.transitions.some(
      (t) => t.from === grievance.status && t.to === targetStageKey,
    );
  } catch {
    // A missing workflow means no edge is defined, which is the same answer.
    return false;
  }
}

function labelForStage(graph: ReturnType<typeof toGraph>, key: string): string {
  return graph.stages.find((s) => s.key === key)?.label ?? key;
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

  // Assignment implies the case is now being worked on. Only do this when the
  // workflow actually defines that move — an admin is free to build a cycle
  // with no "Assigned" stage, and forcing one here would invent a stage that the
  // complaint is then sitting in with no way out.
  const statusBeforeAssignment = grievance.status;
  if (await workflowDefinesMove(grievance, "ASSIGNED")) {
    grievance.status = "ASSIGNED";
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
