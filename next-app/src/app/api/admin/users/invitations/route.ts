import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok, paginated, readQuery, validate } from "@/server/http";
import {
  createInvitation,
  listInvitations,
} from "@/server/services/users.service";
import {
  createInvitationSchema,
  listInvitationsQuerySchema,
} from "@/server/validation/users";
import { Role } from "@/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const viewer = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const query = validate(listInvitationsQuerySchema, readQuery(req));
    const { invitations, pagination } = await listInvitations(
      query,
      viewer.role as Role,
    );
    return paginated(invitations, pagination, "invitations");
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const body = validate(
      createInvitationSchema,
      await req.json().catch(() => ({})),
    );
    const result = await createInvitation(body, user.userId, user.role as Role);
    return ok(result, 201);
  });
}
