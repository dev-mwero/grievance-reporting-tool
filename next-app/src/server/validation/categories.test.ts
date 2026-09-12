import { describe, expect, it } from "vitest";
import { createCategorySchema } from "@/server/validation/categories";

describe("createCategorySchema", () => {
  it("accepts an active category with an optional description", () => {
    expect(
      createCategorySchema.parse({
        name: "Roads",
        description: "Road network issues",
      }),
    ).toBeTruthy();
    expect(createCategorySchema.parse({ name: "Roads" })).toBeTruthy();
  });

  it("requires a non-empty name", () => {
    expect(createCategorySchema.parse({ name: "Roads" })).toBeTruthy();
    expect(() => createCategorySchema.parse({ name: "" })).toThrow();
  });
});
