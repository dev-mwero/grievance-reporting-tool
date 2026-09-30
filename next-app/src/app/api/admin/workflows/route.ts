import type { NextRequest } from "next/server";
import { getActorName, requireRole } from "@/server/auth";
import { handle, ok, paginated, readQuery, validate } from "@/server/http";
import {
  createWorkflow,
  listWorkflows,
} from "@/server/services/workflows.service";
import {
  createWorkflowSchema,
  listWorkflowsQuerySchema,
} from "@/server/validation/workflows";
import { Role } from "@/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const query = validate(listWorkflowsQuerySchema, readQuery(req));
    const { workflows, pagination } = await listWorkflows(query);
    return paginated(workflows, pagination, "workflows");
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const payload = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const body = validate(
      createWorkflowSchema,
      await req.json().catch(() => ({})),
    );
    const workflow = await createWorkflow(
      body,
      payload.userId,
      await getActorName(payload),
    );
    return ok(workflow, 201);
  });
}
