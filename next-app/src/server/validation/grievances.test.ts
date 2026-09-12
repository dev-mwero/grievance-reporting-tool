import { describe, expect, it } from "vitest";
import {
  addUpdateSchema,
  assignGrievanceSchema,
  updateStatusSchema,
} from "@/server/validation/grievances";

describe("updateStatusSchema", () => {
  it("accepts a status and optional note", () => {
    expect(updateStatusSchema.parse({ status: "IN_PROGRESS" })).toBeTruthy();
    expect(
      updateStatusSchema.parse({
        status: "RESOLVED",
        note: "Resolved after inspection",
      }),
    ).toBeTruthy();
  });

  it("rejects unknown statuses", () => {
    expect(() => updateStatusSchema.parse({ status: "DONE" })).toThrow();
    expect(() => updateStatusSchema.parse({ status: "" })).toThrow();
  });
});

describe("assignGrievanceSchema", () => {
  it("requires a primary assignee and defaults supporting list", () => {
    const result = assignGrievanceSchema.parse({ primaryAssigneeId: "u1" });
    expect(result.supportingAssigneeIds).toEqual([]);
  });

  it("accepts supporting assignees", () => {
    const result = assignGrievanceSchema.parse({
      primaryAssigneeId: "u1",
      supportingAssigneeIds: ["u2", "u3"],
    });
    expect(result.supportingAssigneeIds).toHaveLength(2);
  });

  it("rejects a missing primary assignee or non-array supporting list", () => {
    expect(() => assignGrievanceSchema.parse({})).toThrow();
    expect(() =>
      assignGrievanceSchema.parse({
        primaryAssigneeId: "u1",
        supportingAssigneeIds: "u2",
      }),
    ).toThrow();
  });
});

describe("addUpdateSchema", () => {
  it("accepts a public update or internal note", () => {
    expect(
      addUpdateSchema.parse({ type: "PUBLIC_UPDATE", content: "We are on it" }),
    ).toBeTruthy();
    expect(
      addUpdateSchema.parse({
        type: "INTERNAL_NOTE",
        content: "Follow up with ward",
      }),
    ).toBeTruthy();
  });

  it("rejects missing content, short content, or unknown type", () => {
    expect(() =>
      addUpdateSchema.parse({ type: "PUBLIC_UPDATE", content: "" }),
    ).toThrow();
    expect(() =>
      addUpdateSchema.parse({
        type: "SECRET",
        content: "long enough content here",
      }),
    ).toThrow();
  });
});
