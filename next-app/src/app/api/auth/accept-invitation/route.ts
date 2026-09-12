import type { NextRequest } from "next/server";
import { setAuthCookies } from "@/server/auth";
import { handle, ok, validate } from "@/server/http";
import { checkRateLimit } from "@/server/rate-limit";
import { acceptInvitation } from "@/server/services/auth.service";
import { acceptInvitationSchema } from "@/server/validation/auth";

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
