import { describe, expect, it } from "vitest";
import {
  durationToSeconds,
  generateSecureToken,
  hashToken,
} from "@/server/token";

describe("durationToSeconds", () => {
  it("parses unit suffixes", () => {
    expect(durationToSeconds("30s", 0)).toBe(30);
    expect(durationToSeconds("15m", 0)).toBe(900);
    expect(durationToSeconds("1h", 0)).toBe(3600);
    expect(durationToSeconds("7d", 0)).toBe(604800);
  });

  it("defaults to seconds when no unit is given", () => {
    expect(durationToSeconds("45", 0)).toBe(45);
  });

  it("accepts plain numbers", () => {
    expect(durationToSeconds(120, 0)).toBe(120);
  });

  it("falls back on unparseable input", () => {
    expect(durationToSeconds("nope", 99)).toBe(99);
    expect(durationToSeconds("", 99)).toBe(99);
  });
});

describe("generateSecureToken / hashToken", () => {
  it("produces a 64-char hex token", () => {
    expect(generateSecureToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is unique across calls", () => {
    expect(generateSecureToken()).not.toBe(generateSecureToken());
  });

  it("hashes deterministically and irreversibly", () => {
    const token = "abc123";
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toBe(token);
  });
});
