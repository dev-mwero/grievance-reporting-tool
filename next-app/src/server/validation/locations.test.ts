import { describe, expect, it } from "vitest";
import {
  createSubCountySchema,
  createWardSchema,
} from "@/server/validation/locations";

describe("createSubCountySchema", () => {
  it("accepts a named sub-county with a code", () => {
    expect(
      createSubCountySchema.parse({ name: "Embakasi", code: "EMB" }),
    ).toBeTruthy();
  });

  it("requires a name and code", () => {
    expect(() => createSubCountySchema.parse({ name: "" })).toThrow();
    expect(() => createSubCountySchema.parse({ code: "EMB" })).toThrow();
  });
});

describe("createWardSchema", () => {
  it("requires a name, code and parent sub-county", () => {
    expect(
      createWardSchema.parse({
        name: "Maringo",
        code: "MRG",
        subCountyId: "sc1",
      }),
    ).toBeTruthy();
    expect(() =>
      createWardSchema.parse({ name: "Maringo", subCountyId: "sc1" }),
    ).toThrow();
    expect(() =>
      createWardSchema.parse({ code: "MRG", subCountyId: "sc1" }),
    ).toThrow();
    expect(() =>
      createWardSchema.parse({ name: "Maringo", code: "MRG" }),
    ).toThrow();
  });
});
