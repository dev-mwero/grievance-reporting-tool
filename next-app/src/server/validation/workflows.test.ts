import { describe, expect, it } from "vitest";
import {
  createWorkflowSchema,
  listWorkflowsQuerySchema,
  updateWorkflowSchema,
  workflowTransitionSchema,
} from "@/server/validation/workflows";
import { Role } from "@/types";

const validStage = {
  key: "SUBMITTED",
  label: "Submitted",
  isFinal: false,
  order: 0,
};

const validTransition = {
  from: "SUBMITTED",
  to: "RESOLVED",
  actionLabel: "Resolve",
  allowedRoles: [Role.ADMIN],
  requiresApproval: false,
  requiresReason: false,
  requiresAttachment: false,
};

describe("listWorkflowsQuerySchema", () => {
  it("defaults paging and hides deleted workflows", () => {
    const parsed = listWorkflowsQuerySchema.parse({});
    expect(parsed).toMatchObject({
      page: 1,
      limit: 20,
      deletionScope: "active",
    });
  });

  it("accepts an explicit deletion scope and active filter", () => {
    const parsed = listWorkflowsQuerySchema.parse({
      deletionScope: "deleted",
      isActive: "true",
    });
    expect(parsed.deletionScope).toBe("deleted");
    expect(parsed.isActive).toBe("true");
  });
});

describe("workflowTransitionSchema", () => {
  // A move nobody can take looks configured but is permanently unusable.
  it("requires at least one allowed role", () => {
    const result = workflowTransitionSchema.safeParse({
      ...validTransition,
      allowedRoles: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a role outside the Role enum", () => {
    const result = workflowTransitionSchema.safeParse({
      ...validTransition,
      allowedRoles: ["MAYOR"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a fully-specified transition", () => {
    expect(workflowTransitionSchema.safeParse(validTransition).success).toBe(
      true,
    );
  });
});

describe("createWorkflowSchema", () => {
  it("requires at least one stage", () => {
    const result = createWorkflowSchema.safeParse({
      name: "Roads cycle",
      isGlobal: false,
      categoryId: "abc",
      stages: [],
      transitions: [],
      startStageKey: "SUBMITTED",
      isActive: false,
    });
    expect(result.success).toBe(false);
  });

  it("requires a start stage", () => {
    const result = createWorkflowSchema.safeParse({
      name: "Roads cycle",
      isGlobal: false,
      categoryId: "abc",
      stages: [validStage],
      transitions: [],
      startStageKey: "",
      isActive: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a category-scoped workflow", () => {
    const result = createWorkflowSchema.safeParse({
      name: "Roads cycle",
      description: "Potholes and drainage",
      isGlobal: false,
      categoryId: "64b7f0000000000000000c01",
      stages: [validStage],
      transitions: [],
      startStageKey: "SUBMITTED",
      isActive: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("updateWorkflowSchema", () => {
  // Partial updates are how the builder autosaves one node at a time, so every
  // field has to stand alone.
  it("accepts a sparse patch touching only the name", () => {
    expect(updateWorkflowSchema.safeParse({ name: "Renamed" }).success).toBe(
      true,
    );
  });

  it("accepts a patch touching only the transitions", () => {
    expect(
      updateWorkflowSchema.safeParse({ transitions: [validTransition] })
        .success,
    ).toBe(true);
  });

  it("rejects a malformed transition inside a patch", () => {
    const result = updateWorkflowSchema.safeParse({
      transitions: [{ ...validTransition, to: "" }],
    });
    expect(result.success).toBe(false);
  });
});
