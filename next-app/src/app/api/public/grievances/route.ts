import type { NextRequest } from "next/server";
import { created, handle, validate } from "@/server/http";
import { checkRateLimit } from "@/server/rate-limit";
import { submitGrievance } from "@/server/services/public.service";
import { submitGrievanceSchema } from "@/server/validation/public";

export async function POST(req: NextRequest) {
  return handle(async () => {
    // Submission is anonymous and each accepted grievance mails every active
    // administrator, so it is both a spam surface and an outbound-cost
    // amplifier. The per-IP limit stops one source; the global limit bounds
    // the worst case when the source rotates addresses.
    await checkRateLimit(req, "submit-grievance", {
      windowSeconds: 900,
      max: 5,
    });
    await checkRateLimit(req, "submit-grievance-global", {
      windowSeconds: 3600,
      max: 200,
      global: true,
    });
    const body = validate(
      submitGrievanceSchema,
      await req.json().catch(() => ({})),
    );
    const result = await submitGrievance(body);
    return created(result, "Grievance submitted successfully");
  });
}
