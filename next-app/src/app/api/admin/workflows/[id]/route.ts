import type { NextRequest } from "next/server";
import { getActorName, requireRole } from "@/server/auth";
import { createDeletionRoutes } from "@/server/deletion-routes";
import { handle, ok, validate } from "@/server/http";
import {
  getWorkflowById,
  purgeWorkflow,
  restoreWorkflow,
  softDeleteWorkflow,
  updateWorkflow,
} from "@/server/services/workflows.service";
import { updateWorkflowSchema } from "@/server/validation/workflows";
import { Role } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    return ok(await getWorkflowById(id));
  });
}

/** Save an edit to a workflow's stages, moves, or metadata. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const payload = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const body = validate(
      updateWorkflowSchema,
      await req.json().catch(() => ({})),
    );
    const workflow = await updateWorkflow(
      id,
      body,
      payload.userId,
      await getActorName(payload),
    );
    return ok(workflow, 200);
  });
}

const routes = createDeletionRoutes({
  softDelete: softDeleteWorkflow,
  restore: restoreWorkflow,
  purge: purgeWorkflow,
});

export const DELETE = routes.softDelete;
