import { describe, expect, it } from "vitest";
import {
  canTransition,
  GrievanceStatus,
  hasMinimumRole,
  Role,
  STATUS_TRANSITIONS,
} from "@/types";

const allStatuses = Object.values(GrievanceStatus);

describe("GrievanceStatus transitions", () => {
  it("defines a transition table covering every status", () => {
    for (const status of allStatuses) {
      expect(STATUS_TRANSITIONS).toHaveProperty(status);
    }
  });

  it("allows valid forward transitions", () => {
    expect(
      canTransition(GrievanceStatus.SUBMITTED, GrievanceStatus.ACKNOWLEDGED),
    ).toBe(true);
    expect(
      canTransition(GrievanceStatus.UNDER_REVIEW, GrievanceStatus.ASSIGNED),
    ).toBe(true);
    expect(
      canTransition(GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED),
    ).toBe(true);
  });

  it("allows rejection from any open status except RESOLVED", () => {
    const rejectable = allStatuses.filter(
      (s) => !["CLOSED", "REJECTED", "RESOLVED"].includes(s),
    );
    for (const s of rejectable) {
      expect(
        canTransition(s as GrievanceStatus, GrievanceStatus.REJECTED),
      ).toBe(true);
    }
    expect(
      canTransition(GrievanceStatus.RESOLVED, GrievanceStatus.REJECTED),
    ).toBe(false);
  });

  it("rejects invalid transitions", () => {
    expect(
      canTransition(GrievanceStatus.SUBMITTED, GrievanceStatus.ASSIGNED),
    ).toBe(false);
    expect(
      canTransition(GrievanceStatus.CLOSED, GrievanceStatus.IN_PROGRESS),
    ).toBe(false);
    expect(
      canTransition(GrievanceStatus.REJECTED, GrievanceStatus.RESOLVED),
    ).toBe(false);
    expect(
      canTransition(GrievanceStatus.SUBMITTED, GrievanceStatus.SUBMITTED),
    ).toBe(false);
  });

  it("treats CLOSED and REJECTED as terminal", () => {
    expect(STATUS_TRANSITIONS[GrievanceStatus.CLOSED]).toHaveLength(0);
    expect(STATUS_TRANSITIONS[GrievanceStatus.REJECTED]).toHaveLength(0);
  });
});

describe("Role hierarchy", () => {
  it("ranks roles by privilege", () => {
    expect(hasMinimumRole(Role.SUPER_ADMIN, Role.ADMIN)).toBe(true);
    expect(hasMinimumRole(Role.ADMIN, Role.STAFF)).toBe(true);
    expect(hasMinimumRole(Role.SUPER_ADMIN, Role.SUPER_ADMIN)).toBe(true);
  });

  it("rejects insufficient roles", () => {
    expect(hasMinimumRole(Role.STAFF, Role.ADMIN)).toBe(false);
    expect(hasMinimumRole(Role.ADMIN, Role.SUPER_ADMIN)).toBe(false);
  });
});
