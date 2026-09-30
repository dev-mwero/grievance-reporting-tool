import { humanizeStageKey, type StageDescriptor } from "@/lib/stages";
import { ApiError } from "../api-error";
import { Grievance } from "../models/grievance.model";
import {
  type DeletionScope,
  deletionFilter,
  notDeleted,
} from "../models/soft-delete";
import { type IWorkflow, Workflow } from "../models/workflow.model";
import { AuditAction } from "./audit.service";
import { logWorkflowEvent } from "./audit-impl";
import {
  type DeletionActor,
  type DeletionHooks,
  type DeletionTarget,
  purgeRecord,
  restoreRecord,
  softDeleteRecord,
} from "./deletion.service";
import {
  type ValidationIssue,
  validateWorkflowGraph,
  type WorkflowGraph,
} from "./workflow-graph";

const target: DeletionTarget<IWorkflow> = {
  label: "Workflow",
  entityType: "Workflow",
  model: Workflow,
};

const actions = {
  softDelete: AuditAction.WORKFLOW_SOFT_DELETED,
  restore: AuditAction.WORKFLOW_RESTORED,
  purge: AuditAction.WORKFLOW_PURGED,
};

/** Turn validation issues into one message the API can return in an Alert. */
export function describeIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => issue.message).join(" ");
}

function assertGraphIsSane(graph: WorkflowGraph): void {
  const issues = validateWorkflowGraph(graph);
  if (issues.length > 0) {
    throw ApiError.badRequest(describeIssues(issues));
  }
}

/**
 * Resolve which workflow governs a complaint: the category's own workflow when
 * it has an active one, otherwise the global workflow.
 *
 * This is the whole of the "global with room for specifics" rule — a category
 * override wins, and anything without one silently falls back rather than
 * having no cycle at all.
 */
export async function resolveWorkflowForCategory(
  categoryId?: string | null,
): Promise<IWorkflow | null> {
  if (categoryId) {
    const scoped = await Workflow.findOne({
      categoryId,
      isActive: true,
      ...notDeleted(),
    });
    if (scoped) return scoped;
  }

  return Workflow.findOne({ isGlobal: true, isActive: true, ...notDeleted() });
}

/**
 * Stage keys to display metadata, across every active workflow.
 *
 * Loaded once per request rather than per grievance: a list page rendering 25
 * complaints must not issue 25 workflow lookups. Keys are namespaced by workflow
 * in principle but shared in practice — the seed reuses one key per stage across
 * workflows — so a single map is enough and a later workflow simply overrides an
 * earlier label for that key.
 */
export async function loadStageLabels(): Promise<Map<string, StageDescriptor>> {
  const workflows = await Workflow.find({ isActive: true, ...notDeleted() })
    .sort({ createdAt: 1 })
    .lean();

  const map = new Map<string, StageDescriptor>();
  for (const workflow of workflows) {
    for (const stage of workflow.stages) {
      map.set(stage.key, {
        key: stage.key,
        label: stage.label,
        color: stage.color,
        isFinal: stage.isFinal,
        order: stage.order,
      });
    }
  }
  return map;
}

/** Attach `stage` to each grievance so the UI can render a renamed stage correctly. */
export function withStage<T extends { status: string }>(
  items: T[],
  labels: Map<string, StageDescriptor>,
): (T & { stage: StageDescriptor })[] {
  return items.map((item) => ({
    ...item,
    stage: labels.get(item.status) ?? {
      key: item.status,
      label: humanizeStageKey(item.status),
      isFinal: false,
      order: 0,
    },
  }));
}

/** The workflow's stage list plus its transitions, in the shape the graph rules expect. */
export function toGraph(workflow: IWorkflow): WorkflowGraph {
  return {
    stages: workflow.stages.map((stage) => ({
      key: stage.key,
      label: stage.label,
      isFinal: stage.isFinal,
      order: stage.order,
    })),
    transitions: workflow.transitions.map((transition) => ({
      from: transition.from,
      to: transition.to,
      actionLabel: transition.actionLabel,
      allowedRoles: transition.allowedRoles,
      requiresApproval: transition.requiresApproval,
      requiresReason: transition.requiresReason,
      requiresAttachment: transition.requiresAttachment,
      isReopen: transition.isReopen,
    })),
    startStageKey: workflow.startStageKey,
  };
}

// ─── List Workflows ─────────────────────────────────────────────────────────

export async function listWorkflows(query: {
  page: number;
  limit: number;
  search?: string;
  isActive?: string;
  deletionScope?: DeletionScope;
}) {
  const { page, limit, search, isActive, deletionScope } = query;

  const filter: Record<string, unknown> = { ...deletionFilter(deletionScope) };

  if (search) {
    filter.$or = [{ name: { $regex: search, $options: "i" } }];
  }
  if (isActive) filter.isActive = isActive === "true";

  const [workflows, total] = await Promise.all([
    Workflow.find(filter)
      .populate("categoryId", "name")
      .populate("deletedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Workflow.countDocuments(filter),
  ]);

  return {
    workflows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getWorkflowById(id: string) {
  const workflow = await Workflow.findById(id)
    .populate("categoryId", "name")
    .populate("deletedBy", "name email");
  if (!workflow) throw ApiError.notFound("Workflow not found");
  return workflow;
}

// ─── Create / Update ────────────────────────────────────────────────────────

export type WorkflowInput = {
  name: string;
  description?: string;
  categoryId?: string | null;
  isGlobal: boolean;
  stages: WorkflowGraph["stages"];
  transitions: WorkflowGraph["transitions"];
  startStageKey: string;
  isActive: boolean;
};

/** A workflow scoped to a category may only have one active definition. */
async function assertCategoryHasNoActiveWorkflow(
  categoryId: string,
  excludeId?: string,
): Promise<void> {
  const existing = await Workflow.findOne({
    categoryId,
    isActive: true,
    ...notDeleted(),
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select("_id");
  if (existing) {
    throw ApiError.conflict(
      "This category already has an active workflow — deactivate it before activating another",
    );
  }
}

async function assertSingleGlobal(excludeId?: string): Promise<void> {
  const existing = await Workflow.findOne({
    isGlobal: true,
    isActive: true,
    ...notDeleted(),
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select("_id");
  if (existing) {
    throw ApiError.conflict(
      "An active global workflow already exists — deactivate it first",
    );
  }
}

export async function createWorkflow(
  input: WorkflowInput,
  userId: string,
  userName: string,
) {
  assertGraphIsSane({
    stages: input.stages,
    transitions: input.transitions,
    startStageKey: input.startStageKey,
  });

  if (input.isActive) {
    if (input.isGlobal) {
      await assertSingleGlobal();
    } else if (input.categoryId) {
      await assertCategoryHasNoActiveWorkflow(input.categoryId);
    } else {
      throw ApiError.badRequest(
        "Choose a category, or make this the global workflow",
      );
    }
  }

  const workflow = await Workflow.create({
    name: input.name,
    description: input.description,
    categoryId: input.categoryId || undefined,
    isGlobal: input.isGlobal,
    stages: input.stages,
    transitions: input.transitions,
    startStageKey: input.startStageKey,
    isActive: input.isActive,
  });

  await logWorkflowEvent(
    AuditAction.WORKFLOW_CREATED,
    workflow._id.toString(),
    userId,
    userName,
    {
      name: workflow.name,
      isGlobal: workflow.isGlobal,
      active: workflow.isActive,
    },
  );

  return workflow;
}

export async function updateWorkflow(
  id: string,
  input: Partial<WorkflowInput>,
  userId: string,
  userName: string,
) {
  const workflow = await Workflow.findById(id);
  if (!workflow) throw ApiError.notFound("Workflow not found");
  if (workflow.deletedAt) {
    throw ApiError.badRequest(
      "Cannot edit a deleted workflow — restore it first",
    );
  }

  const merged = {
    stages: input.stages ?? workflow.stages,
    transitions: input.transitions ?? workflow.transitions,
    startStageKey: input.startStageKey ?? workflow.startStageKey,
  };
  assertGraphIsSane(merged);

  // Deleting a stage that complaints are currently sitting in would strand them:
  // their status would name a stage that no longer exists, leaving them with no
  // moves and no way to explain why. Renaming is fine; removing is not.
  if (input.stages) {
    const removed = workflow.stages
      .filter((old) => !input.stages?.some((s) => s.key === old.key))
      .map((s) => s.key);

    if (removed.length > 0) {
      const stranded = await Grievance.countDocuments({
        workflowId: workflow._id,
        status: { $in: removed },
        deletedAt: { $exists: false },
      });
      if (stranded > 0) {
        throw ApiError.conflict(
          `${stranded} complaint(s) are in ${removed.join(", ")}. Move them on before deleting those stages.`,
        );
      }
    }
  }

  const isActive = input.isActive ?? workflow.isActive;
  if (isActive) {
    if (input.isGlobal ?? workflow.isGlobal) {
      await assertSingleGlobal(id);
    } else if (input.categoryId ?? workflow.categoryId) {
      await assertCategoryHasNoActiveWorkflow(
        String(input.categoryId ?? workflow.categoryId),
        id,
      );
    }
  }

  const changedKeys = (
    ["name", "description", "isGlobal", "isActive", "startStageKey"] as const
  ).filter((key) => input[key] !== undefined && input[key] !== workflow[key]);

  Object.assign(workflow, {
    name: input.name ?? workflow.name,
    description: input.description ?? workflow.description,
    categoryId:
      input.categoryId === undefined
        ? workflow.categoryId
        : input.categoryId || undefined,
    isGlobal: input.isGlobal ?? workflow.isGlobal,
    isActive,
    startStageKey: merged.startStageKey,
    stages: merged.stages,
    transitions: merged.transitions,
  });

  await workflow.save();

  await logWorkflowEvent(AuditAction.WORKFLOW_UPDATED, id, userId, userName, {
    changedKeys,
    stageCount: merged.stages.length,
  });

  return workflow;
}

/**
 * Turn a workflow on. The last check before complaints start depending on it:
 * complaints reference stage keys, so a workflow that cannot be walked from its
 * start to a final stage would strand cases in between.
 */
export async function activateWorkflow(
  id: string,
  userId: string,
  userName: string,
) {
  const workflow = await Workflow.findById(id);
  if (!workflow) throw ApiError.notFound("Workflow not found");
  if (workflow.deletedAt) {
    throw ApiError.badRequest("Cannot activate a deleted workflow");
  }

  assertGraphIsSane(toGraph(workflow));

  if (workflow.isGlobal) {
    await assertSingleGlobal(id);
  } else if (workflow.categoryId) {
    await assertCategoryHasNoActiveWorkflow(workflow.categoryId.toString(), id);
  }

  workflow.isActive = true;
  await workflow.save();

  await logWorkflowEvent(AuditAction.WORKFLOW_ACTIVATED, id, userId, userName, {
    name: workflow.name,
  });

  return workflow;
}

export async function deactivateWorkflow(
  id: string,
  userId: string,
  userName: string,
) {
  const workflow = await Workflow.findById(id);
  if (!workflow) throw ApiError.notFound("Workflow not found");

  // Deactivating the global workflow with no replacement would leave every
  // category without a cycle, since they all fall back to it.
  if (workflow.isGlobal) {
    const replacement = await Workflow.findOne({
      isGlobal: true,
      isActive: true,
      deletedAt: { $exists: false },
      _id: { $ne: workflow._id },
    }).select("_id");
    if (!replacement) {
      throw ApiError.conflict(
        "This is the only active global workflow — activate another one before deactivating it",
      );
    }
  }

  workflow.isActive = false;
  await workflow.save();

  await logWorkflowEvent(
    AuditAction.WORKFLOW_DEACTIVATED,
    id,
    userId,
    userName,
    { name: workflow.name },
  );

  return workflow;
}

/** Report a workflow's structural problems without changing anything. */
export async function validateWorkflow(id: string) {
  const workflow = await getWorkflowById(id);
  const issues = validateWorkflowGraph(toGraph(workflow));
  return { workflowId: id, valid: issues.length === 0, issues };
}

// ─── Deletion lifecycle ─────────────────────────────────────────────────────

const hooks: DeletionHooks<IWorkflow> = {
  // Complaints hold stage keys rather than a workflow reference, so removing a
  // workflow cannot orphan them outright. What must be blocked is purging a
  // workflow while live complaints still sit on one of its stages — their keys
  // would then resolve to nothing.
  async beforePurge(workflow) {
    const stageKeys = workflow.stages.map((stage) => stage.key);
    if (stageKeys.length === 0) return;

    const using = await Grievance.countDocuments({
      status: { $in: stageKeys },
      deletedAt: { $exists: false },
    });
    if (using === 0) return;

    throw ApiError.conflict(
      workflow.isActive
        ? `Deactivate this workflow before permanently deleting it — ${using} complaint(s) are still on its stages`
        : `${using} complaint(s) are still on this workflow's stages; restore or reassign them before permanently deleting it`,
    );
  },
  metadata(workflow) {
    return { name: workflow.name, isGlobal: workflow.isGlobal };
  },
};

export async function softDeleteWorkflow(
  id: string,
  actor: DeletionActor,
  reason?: string,
) {
  return softDeleteRecord(target, actions, id, actor, hooks, reason);
}

export async function restoreWorkflow(id: string, actor: DeletionActor) {
  return restoreRecord(target, actions, id, actor, hooks);
}

export async function purgeWorkflow(id: string, actor: DeletionActor) {
  return purgeRecord(target, actions, id, actor, hooks);
}
