/**
 * Structural rules a workflow must satisfy before complaints can rely on it.
 *
 * Kept pure and free of Mongoose so it can be exercised directly by tests and
 * reused by the seed, the editor, and the publish endpoint without duplicating
 * the rules three times.
 */

export interface GraphStage {
  key: string;
  label: string;
  isFinal: boolean;
  order: number;
}

export interface GraphTransition {
  from: string;
  to: string;
  actionLabel: string;
  allowedRoles: string[];
  requiresApproval: boolean;
  requiresReason: boolean;
  requiresAttachment: boolean;
  /** The one sanctioned exit from a final stage. Admin-only, reason required. */
  isReopen?: boolean;
}

export interface WorkflowGraph {
  stages: GraphStage[];
  transitions: GraphTransition[];
  startStageKey: string;
}

export interface ValidationIssue {
  /** Machine-readable code, so the UI can point at the offending stage. */
  code:
    | "no-stages"
    | "duplicate-stage-key"
    | "missing-start"
    | "unknown-start"
    | "unknown-transition-endpoint"
    | "unreachable-stage"
    | "dead-end-stage"
    | "final-stage-has-outgoing"
    | "orphan-stage"
    | "transition-without-roles"
    | "reopen-not-admin-only"
    | "reopen-requires-reason";
  message: string;
  /** Stage key the issue relates to, when it relates to exactly one. */
  stageKey?: string;
}

/**
 * Check a workflow graph, returning every problem found rather than throwing on
 * the first. The editor wants to list all of them at once; only the publish
 * path turns a non-empty result into a rejection.
 */
export function validateWorkflowGraph(graph: WorkflowGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const stages = graph.stages ?? [];
  const transitions = graph.transitions ?? [];

  if (stages.length === 0) {
    issues.push({ code: "no-stages", message: "Add at least one stage." });
    return issues;
  }

  const keys = new Set<string>();
  for (const stage of stages) {
    if (keys.has(stage.key)) {
      issues.push({
        code: "duplicate-stage-key",
        message: `Duplicate stage key "${stage.key}".`,
        stageKey: stage.key,
      });
    }
    keys.add(stage.key);
  }

  if (!graph.startStageKey || !keys.has(graph.startStageKey)) {
    issues.push({
      code: "unknown-start",
      message: "The start stage must be one of the stages in this workflow.",
      stageKey: graph.startStageKey,
    });
  }

  for (const transition of transitions) {
    if (!keys.has(transition.from)) {
      issues.push({
        code: "unknown-transition-endpoint",
        message: `A move starts from "${transition.from}", which is not a stage.`,
        stageKey: transition.from,
      });
    }
    if (!keys.has(transition.to)) {
      issues.push({
        code: "unknown-transition-endpoint",
        message: `A move leads to "${transition.to}", which is not a stage.`,
        stageKey: transition.to,
      });
    }
    if (!transition.allowedRoles || transition.allowedRoles.length === 0) {
      issues.push({
        code: "transition-without-roles",
        message: `The move from "${transition.from}" to "${transition.to}" allows nobody.`,
        stageKey: transition.from,
      });
    }
  }

  // Walk the graph from the start. Anything unreachable can never be entered,
  // so a complaint submitted today could not be worked to completion.
  const reachable = new Set<string>();
  if (graph.startStageKey && keys.has(graph.startStageKey)) {
    const queue = [graph.startStageKey];
    reachable.add(graph.startStageKey);
    while (queue.length > 0) {
      const current = queue.shift() as string;
      for (const transition of transitions) {
        if (transition.from !== current) continue;
        if (!keys.has(transition.to) || reachable.has(transition.to)) continue;
        reachable.add(transition.to);
        queue.push(transition.to);
      }
    }
  }

  for (const stage of stages) {
    if (!reachable.has(stage.key)) {
      issues.push({
        code: "unreachable-stage",
        message: `"${stage.label}" cannot be reached from the start stage.`,
        stageKey: stage.key,
      });
    }
  }

  // A non-final stage with no way out strands the complaint there forever.
  // A final stage may still be left by an admin-only reopen — that is the
  // deliberate exception that lets a closed complaint be revived — but it must
  // have no other exit, or "final" stops meaning anything.
  const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

  for (const stage of stages) {
    const outgoing = transitions.filter((t) => t.from === stage.key);
    if (!stage.isFinal) {
      if (outgoing.length === 0) {
        issues.push({
          code: "dead-end-stage",
          message: `"${stage.label}" is not final, so it needs at least one move out of it.`,
          stageKey: stage.key,
        });
      }
      continue;
    }

    const notReopens = outgoing.filter((t) => !t.isReopen);
    if (notReopens.length > 0) {
      issues.push({
        code: "final-stage-has-outgoing",
        message: `"${stage.label}" is final, so it can only be left by a reopen. ${notReopens.length} move(s) out of it are neither.`,
        stageKey: stage.key,
      });
    }

    for (const transition of outgoing.filter((t) => t.isReopen)) {
      const roles = transition.allowedRoles ?? [];
      if (roles.length === 0 || roles.some((r) => !ADMIN_ROLES.has(r))) {
        issues.push({
          code: "reopen-not-admin-only",
          message: `Only an admin may reopen from "${stage.label}". Allow admin roles only on that move.`,
          stageKey: stage.key,
        });
      }
      // Reopening sends the complaint backwards into live work, so it has to be
      // explained. A reopen with no reason would make a revived complaint
      // indistinguishable from one that was never closed.
      if (!transition.requiresReason) {
        issues.push({
          code: "reopen-requires-reason",
          message: `Reopening from "${stage.label}" must ask for a reason.`,
          stageKey: stage.key,
        });
      }
    }
  }

  return issues;
}

/** True when the graph is safe to activate. */
export function isWorkflowGraphValid(graph: WorkflowGraph): boolean {
  return validateWorkflowGraph(graph).length === 0;
}

/**
 * Moves available from a given stage, for the actor's role.
 *
 * Admin and Super Admin see everything: they are the escalation path when a
 * staff member has no configured move available, and the requirement is that an
 * admin can always move a complaint forward or reopen it.
 *
 * `includeApprovalGated` is what separates "may act on this now" from "may ask
 * for this". It is false until staff proposals exist, so a gated move is not
 * offered as a button that would then be refused.
 */
export function availableTransitions(
  graph: WorkflowGraph,
  fromKey: string,
  role: string,
  { includeApprovalGated = false }: { includeApprovalGated?: boolean } = {},
): GraphTransition[] {
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const candidates = graph.transitions.filter((t) => t.from === fromKey);

  if (isAdmin) return candidates;

  return candidates.filter(
    (t) =>
      t.allowedRoles.includes(role) &&
      // A reopen is admin-only by validation; honour it here too so a
      // misconfigured draft cannot hand staff a way to revive a closed case.
      !t.isReopen &&
      (includeApprovalGated || !t.requiresApproval),
  );
}
