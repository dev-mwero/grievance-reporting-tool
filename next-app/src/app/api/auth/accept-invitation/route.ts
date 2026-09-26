import type { NextRequest } from "next/server";
import { ApiError } from "@/server/api-error";
import { setAuthCookies } from "@/server/auth";
import { handle, ok, validate } from "@/server/http";
import { checkRateLimit } from "@/server/rate-limit";
import {
  acceptInvitation,
  getInvitationPreview,
} from "@/server/services/auth.service";
import { acceptInvitationSchema } from "@/server/validation/auth";

/**
 * Preflight for the accept-invitation form. Rejects invalid or expired links
 * before the invitee commits any data, and returns the account details the
 * form displays.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await checkRateLimit(req, "accept-invitation-lookup", {
      windowSeconds: 900,
      max: 30,
    });
    const token = req.nextUrl.searchParams.get("token") ?? "";
    if (!token) {
      throw ApiError.badRequest("Token is required");
    }
    return ok(await getInvitationPreview(token));
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await checkRateLimit(req, "accept-invitation", {
      windowSeconds: 900,
      max: 5,
    });
    const body = validate(
      acceptInvitationSchema,
      await req.json().catch(() => ({})),
    );
    const { user, accessToken, refreshToken } = await acceptInvitation(body);
    await setAuthCookies(accessToken, refreshToken);
    return ok({ user });
  });
}
