import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok, validate } from "@/server/http";
import {
  getSubCountyById,
  updateSubCounty,
} from "@/server/services/locations.service";
import { updateSubCountySchema } from "@/server/validation/locations";
import { Role } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const subCounty = await getSubCountyById(id);
    return ok(subCounty);
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const body = validate(
      updateSubCountySchema,
      await req.json().catch(() => ({})),
    );
    const subCounty = await updateSubCounty(id, body);
    return ok(subCounty, 200);
  });
}
