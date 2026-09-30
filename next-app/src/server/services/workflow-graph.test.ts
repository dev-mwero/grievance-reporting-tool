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
