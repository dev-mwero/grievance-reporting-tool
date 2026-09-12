import type { NextRequest } from "next/server";
import { setAuthCookies } from "@/server/auth";
import { handle, ok, validate } from "@/server/http";
import { checkRateLimit } from "@/server/rate-limit";
import { login } from "@/server/services/auth.service";
import { loginSchema } from "@/server/validation/auth";

export async function POST(req: NextRequest) {
  return handle(async () => {
    await checkRateLimit(req, "login", { windowSeconds: 300, max: 10 });
    const body = validate(loginSchema, await req.json().catch(() => ({})));
    const { user, accessToken, refreshToken } = await login(body);
    await setAuthCookies(accessToken, refreshToken);
    return ok({ user });
  });
}
