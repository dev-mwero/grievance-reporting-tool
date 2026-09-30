import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { getSignedUrl } from "@/server/services/attachments.service";
import { Role } from "@/types";

/**
 * Mint a short-lived signed URL for one attachment.
 *
 * Kept separate from the list endpoint so a single file can be re-fetched
 * without regenerating a URL for the whole complaint's evidence.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  return handle(async () => {
    const user = await requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.STAFF);
    const { attachmentId } = await params;
    return ok(
      await getSignedUrl(attachmentId, {
        userId: user.userId,
        role: user.role,
      }),
    );
  });
}
