import type { NextRequest } from "next/server";
import { handle, ok, validate } from "@/server/http";
import { checkRateLimit } from "@/server/rate-limit";
import { resetPassword } from "@/server/services/auth.service";
import { resetPasswordSchema } from "@/server/validation/auth";

export async function POST(req: NextRequest) {
  return handle(async () => {
    await checkRateLimit(req, "reset-password", { windowSeconds: 900, max: 5 });
    const body = validate(
      resetPasswordSchema,
      await req.json().catch(() => ({})),
    );
    const result = await resetPassword(body);
    return ok(result);
  });
}
