import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth";
import { handle, ok, validate } from "@/server/http";
import { getProfile, updateProfile } from "@/server/services/auth.service";
import { updateProfileSchema } from "@/server/validation/auth";

export async function GET() {
  return handle(async () => {
    const { userId } = await requireAuth();
    const user = await getProfile(userId);
    return ok(user);
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const { userId } = await requireAuth();
    const body = validate(
      updateProfileSchema,
      await req.json().catch(() => ({})),
    );
    const user = await updateProfile(userId, body);
    return ok(user);
  });
}
