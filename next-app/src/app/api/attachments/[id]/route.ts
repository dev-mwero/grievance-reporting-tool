import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { removeAttachment } from "@/server/services/attachments.service";
import { Role } from "@/types";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.STAFF);
    const { id } = await params;
    return ok(
      await removeAttachment(id, { userId: user.userId, role: user.role }),
    );
  });
}
