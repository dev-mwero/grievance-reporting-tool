import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/server/api-error";
import { Role } from "@/types";

const { requireRoleMock, requireSuperAdminMock, getActorNameMock } = vi.hoisted(
  () => ({
    requireRoleMock: vi.fn(),
    requireSuperAdminMock: vi.fn(),
    getActorNameMock: vi.fn(),
  }),
);

vi.mock("@/server/db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/auth", () => ({
  requireRole: requireRoleMock,
  requireSuperAdmin: requireSuperAdminMock,
  getActorName: getActorNameMock,
}));

import { createDeletionRoutes } from "@/server/deletion-routes";

const calls: string[] = [];
const routes = createDeletionRoutes({
  softDelete: async (id, actor, reason) => {
    calls.push(`softDelete:${id}:${actor.id}:${reason ?? ""}`);
    return { op: "softDelete" };
  },
  restore: async (id, actor) => {
    calls.push(`restore:${id}:${actor.id}`);
    return { op: "restore" };
  },
  purge: async (id, actor) => {
    calls.push(`purge:${id}:${actor.id}`);
    return { op: "purge" };
  },
});

const ctx = { params: Promise.resolve({ id: "abc123" }) };

function req(url = "http://localhost/api/admin/categories/abc123") {
  return new NextRequest(new Request(url));
}

/** Make the mocked auth layer behave as the given role. */
function asRole(role: Role) {
  requireRoleMock.mockImplementation(async (...allowed: Role[]) => {
    const rank = { STAFF: 1, ADMIN: 2, SUPER_ADMIN: 3 };
    if (!allowed.some((r) => rank[role] >= rank[r])) {
      throw ApiError.forbidden("Insufficient permissions");
    }
    return { userId: `u-${role}`, role };
  });
  requireSuperAdminMock.mockImplementation(async () => {
    if (role !== Role.SUPER_ADMIN) {
      throw ApiError.forbidden("Super admin access required");
    }
    return { userId: `u-${role}`, role };
  });
}

beforeEach(() => {
  calls.length = 0;
  requireRoleMock.mockReset();
  requireSuperAdminMock.mockReset();
  getActorNameMock.mockReset().mockResolvedValue("Test Actor");
});

describe("soft delete", () => {
  it("lets an admin soft delete", async () => {
    asRole(Role.ADMIN);
    const res = await routes.softDelete(req(), ctx);
    expect(res.status).toBe(200);
    expect(calls).toEqual(["softDelete:abc123:u-ADMIN:"]);
  });

  it("lets a super admin soft delete", async () => {
    asRole(Role.SUPER_ADMIN);
    const res = await routes.softDelete(req(), ctx);
    expect(res.status).toBe(200);
  });

  it("forbids staff", async () => {
    asRole(Role.STAFF);
    const res = await routes.softDelete(req(), ctx);
    expect(res.status).toBe(403);
    expect(calls).toEqual([]);
  });

  it("records the supplied reason", async () => {
    asRole(Role.ADMIN);
    await routes.softDelete(
      req("http://localhost/api/admin/categories/abc123?reason=duplicate"),
      ctx,
    );
    expect(calls).toEqual(["softDelete:abc123:u-ADMIN:duplicate"]);
  });

  it("rejects an over-long reason without deleting anything", async () => {
    asRole(Role.ADMIN);
    const long = "x".repeat(501);
    const res = await routes.softDelete(
      req(`http://localhost/api/admin/categories/abc123?reason=${long}`),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("trims the reason before storing it", async () => {
    asRole(Role.ADMIN);
    await routes.softDelete(
      req(
        "http://localhost/api/admin/categories/abc123?reason=%20%20duplicate%20%20",
      ),
      ctx,
    );
    expect(calls).toEqual(["softDelete:abc123:u-ADMIN:duplicate"]);
  });
});

describe("restore", () => {
  it("lets an admin restore", async () => {
    asRole(Role.ADMIN);
    const res = await routes.restore(req(), ctx);
    expect(res.status).toBe(200);
    expect(calls).toEqual(["restore:abc123:u-ADMIN"]);
  });

  it("forbids staff", async () => {
    asRole(Role.STAFF);
    const res = await routes.restore(req(), ctx);
    expect(res.status).toBe(403);
    expect(calls).toEqual([]);
  });
});

describe("purge", () => {
  it("lets a super admin purge", async () => {
    asRole(Role.SUPER_ADMIN);
    const res = await routes.purge(req(), ctx);
    expect(res.status).toBe(200);
    expect(calls).toEqual(["purge:abc123:u-SUPER_ADMIN"]);
  });

  it("forbids an admin — permanent deletion is super admin only", async () => {
    asRole(Role.ADMIN);
    const res = await routes.purge(req(), ctx);
    expect(res.status).toBe(403);
    expect(calls).toEqual([]);
  });

  it("forbids staff", async () => {
    asRole(Role.STAFF);
    const res = await routes.purge(req(), ctx);
    expect(res.status).toBe(403);
    expect(calls).toEqual([]);
  });

  it("checks the super admin guard rather than the general role guard", async () => {
    // Guards against the two endpoints drifting to share an authorization call.
    asRole(Role.SUPER_ADMIN);
    await routes.purge(req(), ctx);
    expect(requireSuperAdminMock).toHaveBeenCalledTimes(1);
    expect(requireRoleMock).not.toHaveBeenCalled();
  });
});

describe("actor attribution", () => {
  it("attributes the change to the signed-in admin", async () => {
    asRole(Role.ADMIN);
    await routes.softDelete(req(), ctx);
    expect(getActorNameMock).toHaveBeenCalledTimes(1);
  });
});
