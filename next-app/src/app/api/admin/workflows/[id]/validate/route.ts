import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { validateWorkflow } from "@/server/services/workflows.service";
import { Role } from "@/types";

/**
 * Report structural problems with a workflow without saving anything, so the
 * builder can show them live as an admin drags the graph around.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    return ok(await validateWorkflow(id));
  });
}
