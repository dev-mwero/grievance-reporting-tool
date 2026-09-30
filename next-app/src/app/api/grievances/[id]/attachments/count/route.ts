import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { countFor } from "@/server/services/attachments.service";
import { Role } from "@/types";

/**
 * How much evidence a complaint holds.
 *
 * Separate from the evidence list so the move panel can decide whether to offer
 * an uploader without pulling — and signing URLs for — every attachment on the
 * complaint just to count them.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.STAFF);
    const { id } = await params;
    return ok({
      count: await countFor(id, { userId: user.userId, role: user.role }),
    });
  });
}
