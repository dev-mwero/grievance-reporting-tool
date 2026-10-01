import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  pendingFind: vi.fn(),
  pendingDeleteMany: vi.fn(),
  deleteFiles: vi.fn(),
  warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
}));

vi.mock("@/server/models/attachment-upload.model", () => ({
  PendingUpload: {
    find: h.pendingFind,
    deleteMany: h.pendingDeleteMany,
  },
}));

vi.mock("uploadthing/server", () => ({
  UTApi: class {
    deleteFiles = h.deleteFiles;
  },
}));

/**
 * Imported afresh per test.
 *
 * The sweep's rate limit is module state, deliberately: it has to survive across
 * requests within a process. That makes it shared between tests in this file, so
 * a fresh module is the only way to give each one its own budget.
 */
async function loadReaper() {
  vi.resetModules();
  const mod = await import("@/server/services/attachment-reaper");
  return mod.reapExpiredPublicUploads;
}

/** The `.find().select().limit().lean()` chain the sweep uses. */
function mockFind(rows: Array<{ _id: string; fileKey: string }>) {
  const chain = {
    select: () => chain,
    limit: () => chain,
    lean: async () => rows,
  };
  h.pendingFind.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  h.pendingDeleteMany.mockResolvedValue({});
  h.deleteFiles.mockResolvedValue({});
  h.warn.mockClear();
});

describe("reaping abandoned public uploads", () => {
  it("deletes both the record and the stored file", async () => {
    const reap = await loadReaper();
    mockFind([{ _id: "r1", fileKey: "pub/a.png" }]);

    const reaped = await reap();

    expect(reaped).toBe(1);
    expect(h.pendingDeleteMany).toHaveBeenCalledWith({
      _id: { $in: ["r1"] },
    });
    expect(h.deleteFiles).toHaveBeenCalledWith(["pub/a.png"]);
  });

  // The query is what protects claimed evidence: an upload mid-claim must not be
  // swept out from under the request that is claiming it.
  it("only selects expired uploads that nobody has claimed", async () => {
    const reap = await loadReaper();
    mockFind([]);

    await reap();

    expect(h.pendingFind).toHaveBeenCalledWith({
      expiresAt: { $lte: expect.any(Date) },
      claimedAt: { $exists: false },
    });
  });

  it("does nothing when there is nothing expired", async () => {
    const reap = await loadReaper();
    mockFind([]);

    await expect(reap()).resolves.toBe(0);
    expect(h.pendingDeleteMany).not.toHaveBeenCalled();
    expect(h.deleteFiles).not.toHaveBeenCalled();
  });

  // A record whose claim landed between the two queries is left alone: the
  // second lookup re-checks, and a row that has since been claimed is skipped.
  it("skips rows claimed since the first query", async () => {
    const reap = await loadReaper();
    h.pendingFind
      .mockReturnValueOnce({
        select: () => ({
          limit: () => ({
            lean: async () => [{ _id: "r1", fileKey: "a.png" }],
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({ lean: async () => [] }),
      });

    await expect(reap()).resolves.toBe(0);
    expect(h.pendingDeleteMany).not.toHaveBeenCalled();
    expect(h.deleteFiles).not.toHaveBeenCalled();
  });

  // The rows are gone by the time storage is contacted, so a failure there costs
  // storage but not correctness: the app will never serve these files again.
  it("keeps the records deleted when the storage delete fails", async () => {
    const reap = await loadReaper();
    mockFind([{ _id: "r1", fileKey: "pub/a.png" }]);
    h.deleteFiles.mockRejectedValue(new Error("storage down"));

    await expect(reap()).resolves.toBe(1);
    expect(h.pendingDeleteMany).toHaveBeenCalledOnce();
    expect(h.warn).toHaveBeenCalled();
  });

  // Housekeeping must never be the reason a submission fails.
  it("swallows a failed lookup", async () => {
    const reap = await loadReaper();
    h.pendingFind.mockImplementation(() => {
      throw new Error("db down");
    });

    await expect(reap()).resolves.toBe(0);
  });

  // Without the interval, a busy period would sweep on every request. Asserted
  // by the absence of a lookup rather than a call count, because one sweep
  // legitimately queries twice — once to find candidates, once to re-check that
  // they are still unclaimed.
  it("does not sweep again within the interval", async () => {
    const reap = await loadReaper();
    mockFind([{ _id: "r1", fileKey: "pub/a.png" }]);
    await reap();

    h.pendingFind.mockClear();
    mockFind([{ _id: "r2", fileKey: "pub/b.png" }]);

    await expect(reap()).resolves.toBe(0);
    await expect(reap()).resolves.toBe(0);
    expect(h.pendingFind).not.toHaveBeenCalled();
  });

  it("sweeps again once the interval has passed", async () => {
    const reap = await loadReaper();
    mockFind([]);
    await reap();

    h.pendingFind.mockClear();
    vi.setSystemTime(new Date(Date.now() + 6 * 60 * 1000));
    mockFind([]);

    await reap();
    expect(h.pendingFind).toHaveBeenCalled();
  });
});
