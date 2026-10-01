import type { NextRequest } from "next/server";
import { handle, ok } from "@/server/http";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_PUBLIC_EVIDENCE_FILES,
} from "@/server/models/attachment.model";
import { checkRateLimit } from "@/server/rate-limit";
import {
  issueUploadCapability,
  serializeUploadCapability,
  UPLOAD_CAPABILITY_TTL_MS,
} from "@/server/upload-capability";

/**
 * Hand out the capability an anonymous complainant needs to upload evidence.
 *
 * The public form has no account, so this stands in for the login the staff
 * upload route gets from a cookie. It is deliberately cheap — a signed string,
 * no database write — because the public form may fetch one on mount whether or
 * not the visitor ever chooses to attach anything.
 *
 * The limits here mirror the submission endpoint's. A visitor filling in the
 * form and then submitting is two requests, and a cap that stopped the second
 * would be a cap that stopped the actual work; the per-IP budget is set to leave
 * room for a couple of retries around that.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await checkRateLimit(req, "public-upload-token", {
      windowSeconds: 900,
      max: 10,
    });

    const capability = issueUploadCapability();

    return ok({
      capability: serializeUploadCapability(capability),
      // Told to the client so the dropzone can explain a rejected upload as an
      // expired session rather than a mysterious failure.
      expiresAt: new Date(capability.expiresAt).toISOString(),
      maxFiles: MAX_PUBLIC_EVIDENCE_FILES,
      maxFileSizeBytes: MAX_ATTACHMENT_BYTES,
      expiresInSeconds: Math.floor(UPLOAD_CAPABILITY_TTL_MS / 1000),
    });
  });
}
