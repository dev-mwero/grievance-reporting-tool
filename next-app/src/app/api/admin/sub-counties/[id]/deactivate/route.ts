import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { deactivateSubCounty } from "@/server/services/locations.service";
import { Role } from "@/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const { id } = await params;
    const subCounty = await deactivateSubCounty(id);
    return ok(subCounty, 200);
  });
}
