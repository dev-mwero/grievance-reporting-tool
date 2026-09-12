import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { getGrievanceById } from "@/server/services/grievances.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireAuth();
    const { id } = await params;
    const result = await getGrievanceById(id);
    return ok(result);
  });
}
