import { describe, expect, it } from "vitest";
import {
  submitGrievanceSchema,
  trackGrievanceParamsSchema,
} from "@/server/validation/public";

describe("submitGrievanceSchema", () => {
  it("accepts a complete grievance", () => {
    expect(
      submitGrievanceSchema.parse({
        subCountyId: "sc1",
        wardId: "w1",
        categoryId: "c1",
        description: "<p>Road potholes on Majengo street</p>",
      }),
    ).toBeTruthy();
  });

  it("requires ids and a long-enough description", () => {
    expect(() =>
      submitGrievanceSchema.parse({
        subCountyId: "",
        wardId: "w1",
        categoryId: "c1",
        description: "A valid description here",
      }),
    ).toThrow();
    expect(() =>
      submitGrievanceSchema.parse({
        subCountyId: "sc1",
        wardId: "w1",
        categoryId: "c1",
        description: "too short",
      }),
    ).toThrow();
  });

  it("caps description length", () => {
    expect(() =>
      submitGrievanceSchema.parse({
        subCountyId: "sc1",
        wardId: "w1",
        categoryId: "c1",
        description: "x".repeat(20001),
      }),
    ).toThrow();
  });
});

describe("trackGrievanceParamsSchema", () => {
  it("accepts reference codes matching GRV-YYYY-HHHHHHHH", () => {
    expect(
      trackGrievanceParamsSchema.parse({ referenceCode: "GRV-2026-A1B2C3D4" }),
    ).toBeTruthy();
  });

  it("rejects malformed codes and lowercase hex", () => {
    expect(() =>
      trackGrievanceParamsSchema.parse({ referenceCode: "GRV-2026" }),
    ).toThrow();
    expect(() =>
      trackGrievanceParamsSchema.parse({ referenceCode: "grv-2026-a1b2c3d4" }),
    ).toThrow();
    expect(() =>
      trackGrievanceParamsSchema.parse({ referenceCode: "" }),
    ).toThrow();
  });
});
