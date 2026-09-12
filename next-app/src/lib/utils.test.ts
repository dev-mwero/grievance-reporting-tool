import { describe, expect, it } from "vitest";
import {
  cn,
  formatDate,
  formatRelative,
  sanitizeRichText,
  stripHtml,
} from "@/lib/utils";

describe("cn", () => {
  it("merges classes with tailwind-merge", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("a b", false, "c", null)).toBe("a b c");
  });
});

describe("formatDate", () => {
  it("handles empty and invalid input", () => {
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("formats a valid date", () => {
    expect(
      formatDate(new Date("2026-09-12T12:00:00Z"), { dateStyle: "short" }),
    ).toMatch(/9\/12\/26/);
  });
});

describe("formatRelative", () => {
  it("handles empty input", () => {
    expect(formatRelative(null)).toBe("—");
  });

  it("expresses recent times relative to now", () => {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    expect(formatRelative(fiveMinAgo)).toMatch(/minutes? ago/);
  });
});

describe("sanitizeRichText / stripHtml (SSR)", () => {
  it("passes rich text through unchanged on the server", () => {
    expect(sanitizeRichText("<p>Hello <strong>world</strong></p>")).toBe(
      "<p>Hello <strong>world</strong></p>",
    );
  });

  it("strips tags on the server", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe(
      "Hello world",
    );
  });
});
