import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth";
import { handle, ok, validate } from "@/server/http";
import { changePassword } from "@/server/services/auth.service";
import { changePasswordSchema } from "@/server/validation/auth";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { userId } = await requireAuth();
    const body = validate(
      changePasswordSchema,
      await req.json().catch(() => ({})),
    );
    const result = await changePassword(
      userId,
      body.currentPassword,
      body.newPassword,
    );
    return ok(result);
  });
}
