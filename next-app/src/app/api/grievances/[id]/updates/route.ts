import type { NextRequest } from "next/server";
import { getActorName, requireAuth } from "@/server/auth";
import { created, handle, validate } from "@/server/http";
import { addUpdate } from "@/server/services/grievances.service";
import { addUpdateSchema } from "@/server/validation/grievances";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireAuth();
    const { id } = await params;
    const body = validate(addUpdateSchema, await req.json().catch(() => ({})));
    const actorName = await getActorName(user);
    const update = await addUpdate(id, body, user.userId, actorName);
    return created(update, "Update added");
  });
}
