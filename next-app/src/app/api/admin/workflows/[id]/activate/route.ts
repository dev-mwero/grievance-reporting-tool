import type { NextRequest } from "next/server";
import { getActorName, requireRole } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { activateWorkflow } from "@/server/services/workflows.service";
import { Role } from "@/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const payload = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const workflow = await activateWorkflow(
      id,
      payload.userId,
      await getActorName(payload),
    );
    return ok(workflow, 200);
  });
}
