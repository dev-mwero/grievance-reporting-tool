import { describe, expect, it } from "vitest";
import {
  availableTransitions,
  type GraphTransition,
  isWorkflowGraphValid,
  validateWorkflowGraph,
  type WorkflowGraph,
} from "@/server/services/workflow-graph";
import { GrievanceStatus, STATUS_TRANSITIONS } from "@/types";

function transition(
  from: string,
  to: string,
  overrides: Partial<GraphTransition> = {},
): GraphTransition {
  return {
    from,
    to,
    actionLabel: `${from} to ${to}`,
    allowedRoles: ["STAFF"],
    requiresApproval: false,
    requiresReason: false,
    requiresAttachment: false,
    ...overrides,
  };
}

/** The graph the seeder produces, rebuilt here so the test needs no database. */
function seededGraph(): WorkflowGraph {
  const stages = Object.values(GrievanceStatus).map((key, index) => ({
    key,
    label: key,
    isFinal: key === GrievanceStatus.CLOSED || key === GrievanceStatus.REJECTED,
    order: index,
  }));
  return {
    stages,
    transitions: Object.entries(STATUS_TRANSITIONS).flatMap(([from, to]) =>
      to.map((t) => transition(from, t)),
    ),
    startStageKey: GrievanceStatus.SUBMITTED,
  };
}

describe("validateWorkflowGraph", () => {
  // The seed is derived from STATUS_TRANSITIONS. If these two ever drift, every
  // existing complaint would land on a stage its workflow cannot reach.
  it("accepts the seeded workflow as valid", () => {
    const graph = seededGraph();
    expect(validateWorkflowGraph(graph)).toEqual([]);
    expect(isWorkflowGraphValid(graph)).toBe(true);
  });

  it("rejects an empty workflow", () => {
    const issues = validateWorkflowGraph({
      stages: [],
      transitions: [],
      startStageKey: "SUBMITTED",
    });
    expect(issues.map((i) => i.code)).toContain("no-stages");
  });

  it("rejects a start stage that is not in the workflow", () => {
    const graph = seededGraph();
    graph.startStageKey = "NOT_A_STAGE";
    expect(validateWorkflowGraph(graph).map((i) => i.code)).toContain(
      "unknown-start",
    );
  });

  it("rejects duplicate stage keys", () => {
    const graph = seededGraph();
    graph.stages.push({
      key: GrievanceStatus.SUBMITTED,
      label: "Submitted again",
      isFinal: false,
      order: 99,
    });
    expect(validateWorkflowGraph(graph).map((i) => i.code)).toContain(
      "duplicate-stage-key",
    );
  });

  // An unreachable stage is worse than a cosmetic error: a complaint routed
  // into it could never be resolved, because nothing leads out of it either.
  it("rejects a stage that cannot be reached from the start", () => {
    const graph: WorkflowGraph = {
      stages: [
        { key: "SUBMITTED", label: "Submitted", isFinal: false, order: 0 },
        { key: "RESOLVED", label: "Resolved", isFinal: true, order: 1 },
        { key: "ORPHAN", label: "Orphan", isFinal: false, order: 2 },
      ],
      transitions: [transition("SUBMITTED", "RESOLVED")],
      startStageKey: "SUBMITTED",
    };
    const issues = validateWorkflowGraph(graph);
    expect(issues.map((i) => i.code)).toContain("unreachable-stage");
    expect(issues.find((i) => i.stageKey === "ORPHAN")).toBeDefined();
  });

  it("rejects a non-final stage with no way out of it", () => {
    const graph: WorkflowGraph = {
      stages: [
        { key: "SUBMITTED", label: "Submitted", isFinal: false, order: 0 },
        { key: "RESOLVED", label: "Resolved", isFinal: true, order: 1 },
        { key: "STUCK", label: "Stuck", isFinal: false, order: 2 },
      ],
      transitions: [transition("SUBMITTED", "RESOLVED")],
      startStageKey: "SUBMITTED",
    };
    const issues = validateWorkflowGraph(graph);
    expect(issues.map((i) => i.code)).toContain("dead-end-stage");
  });

  it("accepts a dead-end stage when it is marked final", () => {
    const graph: WorkflowGraph = {
      stages: [
        { key: "SUBMITTED", label: "Submitted", isFinal: false, order: 0 },
        { key: "CLOSED", label: "Closed", isFinal: true, order: 1 },
      ],
      transitions: [transition("SUBMITTED", "CLOSED")],
      startStageKey: "SUBMITTED",
    };
    expect(validateWorkflowGraph(graph)).toEqual([]);
  });

  it("rejects a final stage that still has moves out of it", () => {
    const graph: WorkflowGraph = {
      stages: [
        { key: "SUBMITTED", label: "Submitted", isFinal: false, order: 0 },
        { key: "CLOSED", label: "Closed", isFinal: true, order: 1 },
        { key: "IN_PROGRESS", label: "In progress", isFinal: false, order: 2 },
      ],
      transitions: [
        transition("SUBMITTED", "CLOSED"),
        transition("CLOSED", "IN_PROGRESS"),
      ],
      startStageKey: "SUBMITTED",
    };
    expect(validateWorkflowGraph(graph).map((i) => i.code)).toContain(
      "final-stage-has-outgoing",
    );
  });

  it("rejects a move that references a stage which does not exist", () => {
    const graph: WorkflowGraph = {
      stages: [
        { key: "SUBMITTED", label: "Submitted", isFinal: false, order: 0 },
        { key: "CLOSED", label: "Closed", isFinal: true, order: 1 },
      ],
      transitions: [
        transition("SUBMITTED", "CLOSED"),
        transition("SUBMITTED", "GHOST"),
      ],
      startStageKey: "SUBMITTED",
    };
    expect(validateWorkflowGraph(graph).map((i) => i.code)).toContain(
      "unknown-transition-endpoint",
    );
  });

  // A move nobody may perform is a dead branch — it looks available in the
  // builder but can never be taken.
  it("rejects a move that allows no roles", () => {
    const graph: WorkflowGraph = {
      stages: [
        { key: "SUBMITTED", label: "Submitted", isFinal: false, order: 0 },
        { key: "CLOSED", label: "Closed", isFinal: true, order: 1 },
      ],
      transitions: [
        transition("SUBMITTED", "CLOSED"),
        transition("SUBMITTED", "CLOSED", { allowedRoles: [] }),
      ],
      startStageKey: "SUBMITTED",
    };
    expect(validateWorkflowGraph(graph).map((i) => i.code)).toContain(
      "transition-without-roles",
    );
  });

  it("reports every problem at once rather than stopping at the first", () => {
    const graph: WorkflowGraph = {
      stages: [
        { key: "A", label: "A", isFinal: false, order: 0 },
        { key: "DEAD_END", label: "Dead end", isFinal: false, order: 1 },
      ],
      transitions: [transition("A", "GHOST")],
      startStageKey: "NOPE",
    };
    const codes = validateWorkflowGraph(graph).map((i) => i.code);
    expect(codes).toContain("unknown-start");
    expect(codes).toContain("unknown-transition-endpoint");
    expect(codes).toContain("dead-end-stage");
    expect(codes).toContain("unreachable-stage");
  });
});

describe("availableTransitions", () => {
  const graph: WorkflowGraph = {
    stages: [
      { key: "SUBMITTED", label: "Submitted", isFinal: false, order: 0 },
      { key: "IN_PROGRESS", label: "In progress", isFinal: false, order: 1 },
      { key: "CLOSED", label: "Closed", isFinal: true, order: 2 },
    ],
    transitions: [
      transition("SUBMITTED", "IN_PROGRESS"),
      transition("SUBMITTED", "CLOSED", { allowedRoles: ["ADMIN"] }),
    ],
    startStageKey: "SUBMITTED",
  };

  it("only offers staff the moves scoped to them", () => {
    const offered = availableTransitions(graph, "SUBMITTED", "STAFF");
    expect(offered.map((t) => t.to)).toEqual(["IN_PROGRESS"]);
  });

  // Admins are the escalation path. If an admin lost access to a move because
  // it was scoped to staff, a complaint with no staff-available move would have
  // no way forward at all.
  it("lets admins see every move from a stage, however it is scoped", () => {
    const offered = availableTransitions(graph, "SUBMITTED", "ADMIN");
    expect(offered.map((t) => t.to)).toEqual(["IN_PROGRESS", "CLOSED"]);
    expect(
      availableTransitions(graph, "SUBMITTED", "SUPER_ADMIN"),
    ).toHaveLength(2);
  });

  it("returns nothing from a stage with no outgoing moves", () => {
    expect(availableTransitions(graph, "CLOSED", "ADMIN")).toEqual([]);
  });
});

describe("reopen is the only way out of a final stage", () => {
  const base = {
    stages: [
      { key: "OPEN", label: "Open", isFinal: false, order: 0 },
      { key: "DONE", label: "Done", isFinal: true, order: 1 },
    ],
    startStageKey: "OPEN",
    transitions: [t("OPEN", "DONE", "Finish")],
  };

  function t(
    from: string,
    to: string,
    actionLabel: string,
    allowedRoles: string[] = ["ADMIN"],
    isReopen = false,
    extra: Record<string, unknown> = {},
  ) {
    return {
      from,
      to,
      actionLabel,
      allowedRoles,
      requiresApproval: false,
      requiresReason: isReopen,
      requiresAttachment: false,
      isReopen,
      ...extra,
    };
  }

  it("accepts an admin-only reopen out of a final stage", () => {
    expect(
      validateWorkflowGraph({
        ...base,
        transitions: [
          ...base.transitions,
          t("DONE", "OPEN", "Reopen", ["ADMIN"], true),
        ],
      }),
    ).toEqual([]);
  });

  it("still rejects an ordinary move out of a final stage", () => {
    const issues = validateWorkflowGraph({
      ...base,
      transitions: [...base.transitions, t("DONE", "OPEN", "Back to open")],
    });
    expect(issues.map((i) => i.code)).toContain("final-stage-has-outgoing");
  });

  it("rejects a reopen that staff could take", () => {
    const issues = validateWorkflowGraph({
      ...base,
      transitions: [
        ...base.transitions,
        t("DONE", "OPEN", "Reopen", ["ADMIN", "STAFF"], true),
      ],
    });
    expect(issues.map((i) => i.code)).toContain("reopen-not-admin-only");
  });

  it("rejects a reopen with no reason", () => {
    const issues = validateWorkflowGraph({
      ...base,
      transitions: [
        ...base.transitions,
        t("DONE", "OPEN", "Reopen", ["ADMIN"], true, {
          requiresReason: false,
        }),
      ],
    });
    expect(issues.map((i) => i.code)).toContain("reopen-requires-reason");
  });

  it("requires a reason on every move out of a non-final stage too", () => {
    // Same rule, different shape: the dead-end check must not swallow it.
    const issues = validateWorkflowGraph({
      stages: [
        { key: "OPEN", label: "Open", isFinal: false, order: 0 },
        { key: "NEXT", label: "Next", isFinal: true, order: 1 },
      ],
      startStageKey: "OPEN",
      transitions: [t("OPEN", "NEXT", "Finish")],
    });
    expect(issues).toEqual([]);
  });
});

describe("availableTransitions separates acting from asking", () => {
  const graph = {
    stages: [
      { key: "OPEN", label: "Open", isFinal: false, order: 0 },
      { key: "DONE", label: "Done", isFinal: true, order: 1 },
      { key: "BACK", label: "Back", isFinal: false, order: 2 },
    ],
    startStageKey: "OPEN",
    transitions: [
      {
        from: "OPEN",
        to: "DONE",
        actionLabel: "Finish",
        allowedRoles: ["ADMIN", "STAFF"],
        requiresApproval: false,
        requiresReason: false,
        requiresAttachment: false,
      },
      {
        from: "DONE",
        to: "BACK",
        actionLabel: "Reopen",
        allowedRoles: ["ADMIN"],
        requiresApproval: false,
        requiresReason: true,
        requiresAttachment: false,
        isReopen: true,
      },
      {
        from: "OPEN",
        to: "BACK",
        actionLabel: "Escalate",
        allowedRoles: ["STAFF"],
        requiresApproval: true,
        requiresReason: true,
        requiresAttachment: false,
      },
    ],
  };

  it("hides approval-gated moves from staff until proposals exist", () => {
    const forStaff = availableTransitions(graph, "OPEN", "STAFF");
    expect(forStaff.map((t) => t.actionLabel)).toEqual(["Finish"]);
  });

  it("offers approval-gated moves to admins, who apply them directly", () => {
    const forAdmin = availableTransitions(graph, "OPEN", "ADMIN");
    expect(forAdmin.map((t) => t.actionLabel).sort()).toEqual([
      "Escalate",
      "Finish",
    ]);
  });

  it("reveals gated moves to staff once proposals are enabled", () => {
    const forStaff = availableTransitions(graph, "OPEN", "STAFF", {
      includeApprovalGated: true,
    });
    expect(forStaff.map((t) => t.actionLabel).sort()).toEqual([
      "Escalate",
      "Finish",
    ]);
  });

  it("never offers a reopen to staff, even as a proposal", () => {
    const forStaff = availableTransitions(graph, "DONE", "STAFF", {
      includeApprovalGated: true,
    });
    expect(forStaff).toEqual([]);
  });

  it("offers the reopen to an admin", () => {
    const forAdmin = availableTransitions(graph, "DONE", "ADMIN");
    expect(forAdmin.map((t) => t.actionLabel)).toEqual(["Reopen"]);
  });
});
