import { beforeEach, describe, expect, it, vi } from "vitest";

const { findOneMock, updateOneMock, connectMock } = vi.hoisted(() => ({
  findOneMock: vi.fn(),
  updateOneMock: vi.fn(),
  connectMock: vi.fn(),
}));

// The RateLimit model is built inline from mongoose inside rate-limit.ts, so
// stand in a minimal driver rather than reaching for a real database.
vi.mock("mongoose", () => {
  class Schema {
    index() {}
  }
  const model = () => ({ findOne: findOneMock, updateOne: updateOneMock });
  return {
    default: {
      Schema,
      models: { RateLimit: model() },
      model,
    },
    Schema,
  };
});

vi.mock("@/server/db", () => ({
  connectToDatabase: connectMock.mockResolvedValue(undefined),
}));

import { checkRateLimit, checkRateLimitByKey } from "@/server/rate-limit";

function makeReq(ip: string) {
  return { headers: new Headers({ "x-forwarded-for": ip }) } as never;
}

const keysUsed = () =>
  updateOneMock.mock.calls.map((c) => (c[0] as { key: string }).key);

beforeEach(() => {
  findOneMock.mockReset().mockResolvedValue(null);
  updateOneMock.mockReset().mockResolvedValue(undefined);
  connectMock.mockClear();
});

describe("checkRateLimit", () => {
  it("keys per-IP by default so one client cannot spend another's budget", async () => {
    await checkRateLimit(makeReq("1.1.1.1"), "scope", {
      windowSeconds: 60,
      max: 1,
    });
    await checkRateLimit(makeReq("2.2.2.2"), "scope", {
      windowSeconds: 60,
      max: 1,
    });

    expect(keysUsed()).toEqual(["scope:1.1.1.1", "scope:2.2.2.2"]);
  });

  it("shares a single budget across all clients when global", async () => {
    await checkRateLimit(makeReq("1.1.1.1"), "scope", {
      windowSeconds: 60,
      max: 1,
      global: true,
    });
    await checkRateLimit(makeReq("2.2.2.2"), "scope", {
      windowSeconds: 60,
      max: 1,
      global: true,
    });

    expect(keysUsed()).toEqual(["scope:global", "scope:global"]);
  });

  it("rejects once a per-IP budget is spent", async () => {
    findOneMock.mockResolvedValue({
      count: 5,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      checkRateLimit(makeReq("1.1.1.1"), "scope", {
        windowSeconds: 60,
        max: 5,
      }),
    ).rejects.toThrow(/Too many attempts/);
  });

  it("rejects a different IP once the global budget is spent", async () => {
    findOneMock.mockResolvedValue({
      count: 200,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      checkRateLimit(makeReq("9.9.9.9"), "scope", {
        windowSeconds: 3600,
        max: 200,
        global: true,
      }),
    ).rejects.toThrow(/Too many attempts/);
  });

  it("starts a fresh window once the previous one has lapsed", async () => {
    findOneMock.mockResolvedValue({
      count: 99,
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(
      checkRateLimit(makeReq("1.1.1.1"), "scope", {
        windowSeconds: 60,
        max: 1,
      }),
    ).resolves.toBeUndefined();
    expect(updateOneMock).toHaveBeenCalledTimes(1);
  });
});

describe("checkRateLimitByKey", () => {
  beforeEach(() => {
    findOneMock.mockReset().mockResolvedValue(null);
    updateOneMock.mockReset().mockResolvedValue(undefined);
  });

  it("gives each key its own budget", async () => {
    await checkRateLimitByKey("a@gov.go.ke", "acct", {
      windowSeconds: 60,
      max: 1,
    });
    await checkRateLimitByKey("b@gov.go.ke", "acct", {
      windowSeconds: 60,
      max: 1,
    });

    expect(keysUsed()).toEqual(["acct:a@gov.go.ke", "acct:b@gov.go.ke"]);
  });

  it("lowercases the key so casing cannot buy extra attempts", async () => {
    await checkRateLimitByKey("Jane@Gov.go.KE", "acct", {
      windowSeconds: 60,
      max: 1,
    });
    await checkRateLimitByKey("jane@gov.go.ke", "acct", {
      windowSeconds: 60,
      max: 1,
    });

    expect(keysUsed()).toEqual(["acct:jane@gov.go.ke", "acct:jane@gov.go.ke"]);
  });

  it("rejects once that key's budget is spent", async () => {
    findOneMock.mockResolvedValue({
      count: 10,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      checkRateLimitByKey("a@gov.go.ke", "acct", {
        windowSeconds: 900,
        max: 10,
      }),
    ).rejects.toThrow(/Too many attempts/);
  });
});
