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
    // Generous because this runs on every render of the accept form, and
    // invitees at one office share a single NAT address. The 256-bit token is
    // what prevents enumeration; this ceiling only exists to bound abuse, so
    // it must not be the thing that blocks a legitimate onboarding batch.
    await checkRateLimit(req, "accept-invitation-lookup", {
      windowSeconds: 900,
      max: 120,
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
    // Sized for a shared office IP onboarding a batch of staff at once.
    // Account creation is still gated by the unguessable token, and by the
    // duplicate-email check, so this is not a brute-force control.
    await checkRateLimit(req, "accept-invitation", {
      windowSeconds: 900,
      max: 25,
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
