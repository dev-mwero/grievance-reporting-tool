import type { NextRequest } from "next/server";
import { setAuthCookies } from "@/server/auth";
import { handle, ok, validate } from "@/server/http";
import { checkRateLimit, checkRateLimitByKey } from "@/server/rate-limit";
import { login } from "@/server/services/auth.service";
import { loginSchema } from "@/server/validation/auth";

export async function POST(req: NextRequest) {
  return handle(async () => {
    // Per-IP, so one source cannot spray many accounts. Sized for a shared
    // office address where a full team signs in at the same time.
    await checkRateLimit(req, "login", { windowSeconds: 300, max: 30 });

    const body = validate(loginSchema, await req.json().catch(() => ({})));

    // Per-account, for credential stuffing spread across many addresses,
    // which the per-IP limit above cannot see. Run after validation so
    // malformed bodies never consume an account's budget.
    await checkRateLimitByKey(body.email, "login-account", {
      windowSeconds: 900,
      max: 10,
    });

    const { user, accessToken, refreshToken } = await login(body);
    await setAuthCookies(accessToken, refreshToken);
    return ok({ user });
  });
}
