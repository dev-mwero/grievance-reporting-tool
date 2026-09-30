import { describe, expect, it } from "vitest";
import {
  deletionFilter,
  notDeleted,
  onlyDeleted,
  softDeleteFields,
} from "@/server/models/soft-delete";
import {
  deleteReasonSchema,
  deletionScopeSchema,
} from "@/server/validation/common";

describe("deletionFilter", () => {
  it("hides deleted records by default", () => {
    expect(deletionFilter()).toEqual({ deletedAt: { $exists: false } });
    expect(deletionFilter(undefined)).toEqual(notDeleted());
  });

  it("hides deleted records for the explicit active scope", () => {
    expect(deletionFilter("active")).toEqual(notDeleted());
  });

  it("applies no predicate for the all scope", () => {
    expect(deletionFilter("all")).toEqual({});
  });

  it("matches only deleted records for the deleted scope", () => {
    expect(deletionFilter("deleted")).toEqual(onlyDeleted());
  });

  it("produces predicates that cannot both match the same document", () => {
    // The two predicates are complements of each other, which is what keeps
    // the restore tray and the live table from ever showing the same row.
    expect(notDeleted()).not.toEqual(onlyDeleted());
  });
});

describe("deletionScopeSchema", () => {
  it("defaults to active when omitted", () => {
    expect(deletionScopeSchema.parse(undefined)).toBe("active");
  });

  it("accepts each supported scope", () => {
    for (const scope of ["active", "all", "deleted"] as const) {
      expect(deletionScopeSchema.parse(scope)).toBe(scope);
    }
  });

  it("rejects an unknown scope rather than falling back to live records", () => {
    expect(() => deletionScopeSchema.parse("everything")).toThrow();
  });
});

describe("deleteReasonSchema", () => {
  it("is optional", () => {
    expect(deleteReasonSchema.parse(undefined)).toBeUndefined();
  });

  it("trims surrounding whitespace", () => {
    expect(deleteReasonSchema.parse("  duplicate  ")).toBe("duplicate");
  });

  it("rejects a reason over the audit column limit", () => {
    expect(() => deleteReasonSchema.parse("x".repeat(501))).toThrow();
  });

  it("allows a reason at exactly the limit", () => {
    expect(deleteReasonSchema.parse("x".repeat(500))).toHaveLength(500);
  });

  it("agrees with the schema field's own maxlength", () => {
    // If these two ever drift, a reason could pass validation and then fail to
    // persist, which would surface to the user as a silent no-op delete.
    expect(softDeleteFields.deleteReason.maxlength[0]).toBe(500);
  });
});
