import type { NextRequest } from "next/server";
import { requireRole } from "@/server/auth";
import { handle, ok, paginated, readQuery, validate } from "@/server/http";
import { createWard, listWards } from "@/server/services/locations.service";
import {
  createWardSchema,
  listWardsQuerySchema,
} from "@/server/validation/locations";
import { Role } from "@/types";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const query = validate(listWardsQuerySchema, readQuery(req));
    const { wards, pagination } = await listWards(query);
    return paginated(wards, pagination);
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireRole(Role.ADMIN, Role.SUPER_ADMIN);
    const body = validate(createWardSchema, await req.json().catch(() => ({})));
    const ward = await createWard(body);
    return ok(ward, 201);
  });
}
