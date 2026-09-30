import type { NextRequest } from "next/server";
import { getActorName, requireRole } from "@/server/auth";
import { handle, ok, validate } from "@/server/http";
import {
  attachToGrievance,
  listWithSignedUrls,
} from "@/server/services/attachments.service";
import { claimAttachmentsSchema } from "@/server/validation/attachments";
import { Role } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.STAFF);
    const { id } = await params;
    return ok(
      await listWithSignedUrls(id, { userId: user.userId, role: user.role }),
    );
  });
}

/**
 * Attach files the client has already uploaded.
 *
 * The file bytes go straight to the storage route; this only records the claim,
 * which is why the body is a list of keys rather than multipart form data. The
 * service verifies each key against the app's own record of who uploaded it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireRole(Role.ADMIN, Role.SUPER_ADMIN, Role.STAFF);
    const { id } = await params;
    const body = validate(
      claimAttachmentsSchema,
      await req.json().catch(() => ({})),
    );
    const attachments = await attachToGrievance(
      id,
      body.fileKeys.map((fileKey) => ({ fileKey })),
      {
        userId: user.userId,
        name: await getActorName(user),
        role: user.role,
      },
      { transitionRequestId: body.transitionRequestId },
    );
    return ok(attachments, 201);
  });
}
