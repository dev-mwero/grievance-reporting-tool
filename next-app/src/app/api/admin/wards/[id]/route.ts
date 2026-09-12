import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok, validate } from "@/server/http";
import { getWardById, updateWard } from "@/server/services/locations.service";
import { updateWardSchema } from "@/server/validation/locations";
import { Role } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const ward = await getWardById(id);
    return ok(ward);
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const body = validate(updateWardSchema, await req.json().catch(() => ({})));
    const ward = await updateWard(id, body);
    return ok(ward, 200);
  });
}
