import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ now: 0 }));

vi.useFakeTimers();
vi.setSystemTime(new Date("2026-03-01T10:00:00.000Z"));
h.now = Date.now();

import {
  issueUploadCapability,
  serializeUploadCapability,
  UPLOAD_CAPABILITY_TTL_MS,
  verifyUploadCapability,
} from "@/server/upload-capability";

function issue() {
  return serializeUploadCapability(issueUploadCapability());
}

describe("upload capability", () => {
  it("round-trips a freshly issued capability", () => {
    const token = issue();
    const verified = verifyUploadCapability(token);

    expect(verified).not.toBeNull();
    expect(verified?.submissionId).toMatch(/^[a-f0-9]{32}$/);
    expect(verified?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("issues a different id every time", () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => issueUploadCapability().submissionId),
    );
    expect(ids.size).toBe(50);
  });

  it("rejects a missing, empty, or malformed token", () => {
    expect(verifyUploadCapability(undefined)).toBeNull();
    expect(verifyUploadCapability("")).toBeNull();
    expect(verifyUploadCapability("no-separator")).toBeNull();
    // A leading separator would leave an empty id, which was never issued.
    expect(verifyUploadCapability(".signature")).toBeNull();
    expect(verifyUploadCapability("abc.def")).toBeNull();
    // Right shape, but not hex.
    expect(verifyUploadCapability(`${"z".repeat(32)}.sig`)).toBeNull();
  });

  it("rejects a token whose id is not one it issued", () => {
    // Correctly shaped, correctly signed by nobody. A client that learned a file
    // key must not be able to pair it with an id of its own choosing.
    const forged = `${Date.now().toString(16).padStart(12, "0")}${"a".repeat(20)}.anything`;
    expect(verifyUploadCapability(forged)).toBeNull();
  });

  it("rejects a valid id paired with a wrong signature", () => {
    const token = issue();
    const [id] = token.split(".");

    expect(verifyUploadCapability(`${id}.deadbeef`)).toBeNull();
    expect(verifyUploadCapability(`${id}.`)).toBeNull();
    // Truncating a genuine signature must not verify.
    const genuine = token.slice(token.indexOf(".") + 1);
    expect(verifyUploadCapability(`${id}.${genuine.slice(0, -2)}`)).toBeNull();
  });

  it("rejects a signature swapped from a different capability", () => {
    const a = issue();
    const b = issue();
    const [idA] = a.split(".");
    const sigB = b.slice(b.indexOf(".") + 1);

    // The signature is over the id, so this pairing is meaningless even though
    // both halves were legitimately issued.
    expect(verifyUploadCapability(`${idA}.${sigB}`)).toBeNull();
  });

  it("rejects a token whose id has been edited to extend its life", () => {
    const token = issue();
    const [id] = token.split(".");
    const sig = token.slice(token.indexOf(".") + 1);

    // Push the embedded timestamp back by an hour. The signature covers the id,
    // so this cannot verify — expiry is not something a client can edit.
    const issuedAt = Number.parseInt(id.slice(0, 12), 16);
    const tampered = `${(issuedAt - 60 * 60 * 1000)
      .toString(16)
      .padStart(12, "0")}${id.slice(12)}.${sig}`;

    expect(verifyUploadCapability(tampered)).toBeNull();
  });

  it("stops verifying once the lifetime is spent", () => {
    const token = issue();
    expect(verifyUploadCapability(token)).not.toBeNull();

    vi.setSystemTime(new Date(Date.now() + UPLOAD_CAPABILITY_TTL_MS + 1000));
    expect(verifyUploadCapability(token)).toBeNull();
  });

  it("still verifies just inside the lifetime", () => {
    const token = issue();
    vi.setSystemTime(new Date(Date.now() + UPLOAD_CAPABILITY_TTL_MS - 5000));
    expect(verifyUploadCapability(token)).not.toBeNull();
  });

  it("rejects a token dated implausibly far in the future", () => {
    // Well-formed, and would be correctly signed by anyone holding the secret —
    // which is exactly why the timestamp bound is checked as well.
    const future = (Date.now() + 10 * 60 * 60 * 1000)
      .toString(16)
      .padStart(12, "0");
    const id = `${future}${"a".repeat(20)}`;
    const token = serializeUploadCapability({
      submissionId: id,
      expiresAt: Date.now() + UPLOAD_CAPABILITY_TTL_MS,
    });

    expect(verifyUploadCapability(token)).toBeNull();
  });

  it("survives a string long enough to be worth rejecting early", () => {
    expect(
      verifyUploadCapability(`${"a".repeat(32)}.${"b".repeat(4096)}`),
    ).toBeNull();
  });
});

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
});
