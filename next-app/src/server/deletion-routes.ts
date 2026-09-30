import type { NextRequest } from "next/server";
import { z } from "zod";
import { Role } from "@/types";
import { getActorName, requireRole, requireSuperAdmin } from "./auth";
import { handle, ok, readQuery } from "./http";
import type { DeletionActor } from "./services/deletion.service";
import { deleteReasonSchema } from "./validation/common";

/** The three lifecycle operations every admin-managed entity exposes. */
export interface EntityDeletionHandlers {
  softDelete: (
    id: string,
    actor: DeletionActor,
    reason?: string,
  ) => Promise<unknown>;
  restore: (id: string, actor: DeletionActor) => Promise<unknown>;
  purge: (id: string, actor: DeletionActor) => Promise<unknown>;
}

type RouteContext = { params: Promise<{ id: string }> };

const deleteQuerySchema = z.object({ reason: deleteReasonSchema });

/**
 * Build the deletion Route Handlers for an entity so each route file stays a
 * one-liner and the privilege split is declared in exactly one place:
 *
 * - `DELETE /[id]`       soft delete — ADMIN and SUPER_ADMIN
 * - `POST   /[id]/restore`  restore    — ADMIN and SUPER_ADMIN
 * - `DELETE /[id]/purge`     purge      — SUPER_ADMIN only
 */
export function createDeletionRoutes(handlers: EntityDeletionHandlers) {
  return {
    softDelete: async (req: NextRequest, { params }: RouteContext) => {
      return handle(async () => {
        const payload = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
        const { id } = await params;
        const { reason } = deleteQuerySchema.parse(readQuery(req));
        const actor: DeletionActor = {
          id: payload.userId,
          name: await getActorName(payload),
        };
        return ok(await handlers.softDelete(id, actor, reason), 200);
      });
    },

    restore: async (_req: NextRequest, { params }: RouteContext) => {
      return handle(async () => {
        const payload = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
        const { id } = await params;
        const actor: DeletionActor = {
          id: payload.userId,
          name: await getActorName(payload),
        };
        return ok(await handlers.restore(id, actor), 200);
      });
    },

    purge: async (_req: NextRequest, { params }: RouteContext) => {
      return handle(async () => {
        const payload = await requireSuperAdmin();
        const { id } = await params;
        const actor: DeletionActor = {
          id: payload.userId,
          name: await getActorName(payload),
        };
        return ok(await handlers.purge(id, actor), 200);
      });
    },
  };
}
