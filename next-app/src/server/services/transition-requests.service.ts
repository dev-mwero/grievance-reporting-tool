import mongoose from "mongoose";
import { stageFor } from "@/lib/stages";
import { Role } from "@/types";
import { ApiError } from "../api-error";
import { Attachment } from "../models/attachment.model";
import { Grievance } from "../models/grievance.model";
import {
  type ITransitionRequest,
  TransitionRequest,
} from "../models/grievance-transition-request.model";
import { User } from "../models/user.model";
import { type IWorkflow, Workflow } from "../models/workflow.model";
import { attachToGrievance } from "./attachments.service";
import { AuditAction } from "./audit.service";
import { logGrievanceEvent } from "./audit-impl";
import { updateStatus } from "./grievances.service";
import { createNotifications } from "./notification.service";
import { availableTransitions } from "./workflow-graph";
import {
  loadStageLabels,
  resolveWorkflowForCategory,
} from "./workflows.service";

function isAdminRole(role: string): boolean {
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

// ─── Propose ─────────────────────────────────────────────────────────────────

/**
 * Record a staff member's request to move a complaint.
 *
 * Proposing does not move the complaint. It parks the request for an admin,
 * because the whole point of an approval-gated move is that staff cannot take it
 * unilaterally — applying it here would make the flag meaningless.
 */
export async function proposeTransition(
  grievanceId: string,
  input: { to: string; reason: string },
  userId: string,
  userName: string,
  role: string,
  opts: { attachmentKeys?: string[] } = {},
) {
  if (isAdminRole(role)) {
    // An admin has no reason to route around their own authority.
    throw ApiError.badRequest(
      "Admins move complaints directly — no approval needed",
    );
  }

  const grievance = await Grievance.findById(grievanceId);
  if (!grievance || grievance.deletedAt) {
    throw ApiError.notFound("Grievance not found");
  }

  const assigned =
    grievance.primaryAssigneeId?.toString() === userId ||
    grievance.supportingAssignees.some((id) => id.toString() === userId);
  if (!assigned) {
    throw ApiError.forbidden(
      "You can only propose moves on complaints assigned to you",
    );
  }

  const workflow = await loadWorkflow(grievance);
  const graph = await loadGraph(workflow);

  // Reuse the same gate that authorises a direct move, but include the gated
  // ones — proposing an approval-gated move is precisely the point.
  const available = availableTransitions(graph, grievance.status, role, {
    includeApprovalGated: true,
  });
  const edge = available.find((t) => t.to === input.to);

  if (!edge) {
    const configured = graph.transitions.some(
      (t) => t.from === grievance.status && t.to === input.to,
    );
    throw ApiError.badRequest(
      configured
        ? "You cannot propose that move"
        : `No move from "${grievance.status}" to "${input.to}" is defined in this workflow`,
    );
  }

  // Only moves that actually require approval are proposable. Offering staff
  // the slower, approval-gated route for a move they could simply take would be
  // a worse experience for no gain.
  if (!edge.requiresApproval) {
    throw ApiError.badRequest(
      `"${edge.actionLabel}" does not need approval — apply it directly`,
    );
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw ApiError.badRequest("A reason is required to propose a move");
  }

  // Evidence is claimed before the request exists so that the move is never
  // queued without it. Doing it in this order means the approver's queue never
  // holds a request whose supporting evidence is still in flight.
  const attachmentKeys = opts.attachmentKeys ?? [];
  if (attachmentKeys.length > 0) {
    await attachToGrievance(
      grievanceId,
      attachmentKeys.map((fileKey) => ({ fileKey })),
      { userId, name: userName, role },
    );
  }

  // The same rule the direct move enforces: a move configured to need evidence
  // cannot be requested on a note alone. Checked after the uploads are attached
  // so evidence supplied with the proposal satisfies it.
  if (edge.requiresAttachment) {
    const evidence = await Attachment.countDocuments({
      grievanceId: grievance._id,
    });
    if (evidence === 0) {
      throw ApiError.badRequest(
        `"${edge.actionLabel}" requires at least one attachment as evidence`,
      );
    }
  }

  const existing = await TransitionRequest.findOne({
    grievanceId: grievance._id,
    status: "PENDING",
  });
  if (existing) {
    throw ApiError.conflict(
      "A move is already awaiting approval on this complaint — withdraw it first",
    );
  }

  const labels = await loadStageLabels();
  const fromLabel = stageFor(grievance.status, labels).label;
  const toLabel = stageFor(input.to, labels).label;

  const request = await TransitionRequest.create({
    grievanceId: grievance._id,
    referenceCode: grievance.referenceCode,
    workflowId: workflow._id,
    fromStage: grievance.status,
    toStage: input.to,
    actionLabel: edge.actionLabel,
    proposedBy: new mongoose.Types.ObjectId(userId),
    proposedByName: userName,
    reason,
    status: "PENDING",
  });

  await logGrievanceEvent(
    AuditAction.GRIEVANCE_TRANSITION_PROPOSED,
    grievanceId,
    userId,
    userName,
    { from: grievance.status, to: input.to, action: edge.actionLabel },
  );

  await notifyAdminsOfRequest(request, `${fromLabel} → ${toLabel}`);

  return request;
}

// ─── Review ──────────────────────────────────────────────────────────────────

/**
 * Approve a proposed move, applying it to the complaint.
 *
 * The move is re-authorised against the workflow at approval time rather than
 * trusted from proposal time. An admin may have deleted or re-scoped the move in
 * between, and applying a stale one would move a complaint through a step that no
 * longer exists.
 */
export async function approveTransition(
  requestId: string,
  reviewer: { userId: string; name: string; role: string },
) {
  if (!isAdminRole(reviewer.role)) {
    throw ApiError.forbidden("Only an admin may approve a proposed move");
  }

  const request = await TransitionRequest.findById(requestId);
  if (!request) throw ApiError.notFound("Request not found");
  if (request.status !== "PENDING") {
    throw ApiError.badRequest(
      `This request was already ${request.status.toLowerCase()}`,
    );
  }

  const grievance = await Grievance.findById(request.grievanceId);
  if (!grievance || grievance.deletedAt) {
    // The complaint is gone or under deletion. Close the request out rather than
    // leaving it pending forever in the queue.
    await resolveAsSuperseded(request, reviewer);
    throw ApiError.badRequest(
      "This complaint is no longer available, so the request was closed",
    );
  }

  // The proposal was written against a specific origin stage. If the complaint
  // has moved since, the proposed edge no longer applies — approving it would
  // jump the complaint from wherever it is now to a stage chosen for a different
  // situation.
  if (grievance.status !== request.fromStage) {
    await resolveAsSuperseded(request, reviewer);
    throw ApiError.conflict(
      `This complaint has already moved to another stage, so the request no longer applies`,
    );
  }

  // The admin's own note, if any, is the reason recorded against the move. The
  // proposer's reason stays on the request for the record.
  await updateStatus(
    grievance._id.toString(),
    { status: request.toStage, note: request.reason },
    reviewer.userId,
    `${reviewer.name} (approving ${request.proposedByName})`,
    reviewer.role,
    // This request is the one causing the move, so it must survive its own
    // side effect and go on to be marked approved.
    { exceptRequestId: request._id.toString() },
  );

  request.status = "APPROVED";
  request.reviewedBy = new mongoose.Types.ObjectId(reviewer.userId);
  request.reviewedByName = reviewer.name;
  request.reviewedAt = new Date();
  await request.save();

  await logGrievanceEvent(
    AuditAction.GRIEVANCE_TRANSITION_APPROVED,
    grievance._id.toString(),
    reviewer.userId,
    reviewer.name,
    { from: request.fromStage, to: request.toStage, requestId },
  );

  await createNotifications([
    {
      recipientId: request.proposedBy.toString(),
      type: "GRIEVANCE_STATUS_CHANGED",
      title: `Move approved on ${request.referenceCode}`,
      message: `"${request.actionLabel}" was approved by ${reviewer.name}.`,
      grievanceId: grievance._id.toString(),
      referenceCode: grievance.referenceCode,
    },
  ]);

  return request;
}

export async function rejectTransition(
  requestId: string,
  input: { note?: string },
  reviewer: { userId: string; name: string; role: string },
) {
  if (!isAdminRole(reviewer.role)) {
    throw ApiError.forbidden("Only an admin may decline a proposed move");
  }

  const request = await TransitionRequest.findById(requestId);
  if (!request) throw ApiError.notFound("Request not found");
  if (request.status !== "PENDING") {
    throw ApiError.badRequest(
      `This request was already ${request.status.toLowerCase()}`,
    );
  }

  request.status = "REJECTED";
  request.reviewedBy = new mongoose.Types.ObjectId(reviewer.userId);
  request.reviewedByName = reviewer.name;
  request.reviewedAt = new Date();
  request.decisionNote = input.note?.trim() || undefined;
  await request.save();

  await logGrievanceEvent(
    AuditAction.GRIEVANCE_TRANSITION_REJECTED,
    request.grievanceId.toString(),
    reviewer.userId,
    reviewer.name,
    { from: request.fromStage, to: request.toStage, requestId },
  );

  await createNotifications([
    {
      recipientId: request.proposedBy.toString(),
      type: "GRIEVANCE_STATUS_CHANGED",
      title: `Move declined on ${request.referenceCode}`,
      message: `"${request.actionLabel}" was declined by ${reviewer.name}${
        request.decisionNote ? `: ${request.decisionNote}` : "."
      }`,
      grievanceId: request.grievanceId.toString(),
      referenceCode: request.referenceCode,
    },
  ]);

  return request;
}

/**
 * Withdraw your own proposal. Kept separate from rejection because nobody
 * declined it — the proposer changed their mind, and the record should say so.
 */
export async function withdrawTransition(
  requestId: string,
  userId: string,
  userName: string,
  role: string,
) {
  const request = await TransitionRequest.findById(requestId);
  if (!request) throw ApiError.notFound("Request not found");
  if (request.proposedBy.toString() !== userId && !isAdminRole(role)) {
    throw ApiError.forbidden("You can only withdraw your own request");
  }
  if (request.status !== "PENDING") {
    throw ApiError.badRequest(
      `This request was already ${request.status.toLowerCase()}`,
    );
  }

  request.status = "WITHDRAWN";
  request.reviewedBy = new mongoose.Types.ObjectId(userId);
  request.reviewedByName = userName;
  request.reviewedAt = new Date();
  await request.save();

  await logGrievanceEvent(
    AuditAction.GRIEVANCE_TRANSITION_WITHDRAWN,
    request.grievanceId.toString(),
    userId,
    userName,
    { from: request.fromStage, to: request.toStage, requestId },
  );

  return request;
}

/**
 * Mark requests overtaken by a stage change. Called after any direct move, so the
 * approval queue never shows a proposal that the complaint has already passed.
 *
 * Deliberately silent: this is housekeeping, and a caller who just moved a
 * complaint should not be told it also cleaned up some unrelated request.
 */
export async function supersedeForGrievance(
  grievanceId: string,
  excludeRequestId?: string,
) {
  await TransitionRequest.updateMany(
    {
      grievanceId,
      status: "PENDING",
      // Approving a request applies a move, which lands here and would otherwise
      // close the very request being approved — telling its proposer it "no longer
      // applies" in the same breath as it was approved.
      ...(excludeRequestId
        ? { _id: { $ne: new mongoose.Types.ObjectId(excludeRequestId) } }
        : {}),
    },
    {
      $set: {
        status: "SUPERSEDED",
        reviewedAt: new Date(),
        decisionNote: "The complaint moved on before this was reviewed.",
      },
    },
  );
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listRequests(query: {
  status?: string;
  page: number;
  limit: number;
}) {
  const { status, page, limit } = query;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const [requests, total] = await Promise.all([
    TransitionRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    TransitionRequest.countDocuments(filter),
  ]);

  return {
    requests,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/** This complaint's own request history, newest first. */
export async function listForGrievance(grievanceId: string) {
  return TransitionRequest.find({ grievanceId }).sort({ createdAt: -1 }).lean();
}

/** The single pending request on a complaint, if any. Drives the detail page. */
export async function findPending(grievanceId: string) {
  return TransitionRequest.findOne({ grievanceId, status: "PENDING" }).lean();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loadGraph(workflow: IWorkflow) {
  const { toGraph } = await import("./workflows.service");
  return toGraph(workflow);
}

/**
 * The workflow governing a complaint, pinned at submission where possible so a
 * later edit cannot change which moves apply to a case already in flight.
 */
async function loadWorkflow(grievance: {
  workflowId?: mongoose.Types.ObjectId;
  categoryId?: unknown;
}) {
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
    throw ApiError.badRequest(
      "No active complaint workflow is configured for this category",
    );
  }
  return resolved;
}

async function resolveAsSuperseded(
  request: ITransitionRequest,
  reviewer: { userId: string; name: string },
) {
  request.status = "SUPERSEDED";
  request.reviewedBy = new mongoose.Types.ObjectId(reviewer.userId);
  request.reviewedByName = reviewer.name;
  request.reviewedAt = new Date();
  request.decisionNote = "The complaint moved on before this was reviewed.";
  await request.save();

  await logGrievanceEvent(
    AuditAction.GRIEVANCE_TRANSITION_SUPERSEDED,
    request.grievanceId.toString(),
    reviewer.userId,
    reviewer.name,
    { from: request.fromStage, to: request.toStage },
  );

  await createNotifications([
    {
      recipientId: request.proposedBy.toString(),
      type: "GRIEVANCE_STATUS_CHANGED",
      title: `Request closed on ${request.referenceCode}`,
      message: `"${request.actionLabel}" no longer applies — the complaint moved on.`,
      grievanceId: request.grievanceId.toString(),
      referenceCode: request.referenceCode,
    },
  ]);
}

/** Tell every admin there is a move waiting on them. */
async function notifyAdminsOfRequest(
  request: ITransitionRequest,
  moveLabel: string,
) {
  const admins = await User.find({
    role: { $in: [Role.ADMIN, Role.SUPER_ADMIN] },
    isActive: true,
    deletedAt: { $exists: false },
  }).select("_id");

  await createNotifications(
    admins.map((admin) => ({
      recipientId: admin._id.toString(),
      type: "GRIEVANCE_UPDATE" as const,
      title: `Move awaiting approval on ${request.referenceCode}`,
      message: `${request.proposedByName} asked to move ${moveLabel}.`,
      grievanceId: request.grievanceId.toString(),
      referenceCode: request.referenceCode,
    })),
  );
}
