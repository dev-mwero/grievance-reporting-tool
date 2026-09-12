import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { revokeInvitation } from "@/server/services/users.service";
import { Role } from "@/types";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const result = await revokeInvitation(id);
    return ok(result);
  });
}
