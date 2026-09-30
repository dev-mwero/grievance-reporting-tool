import { z } from "zod";

const fileKeySchema = z
  .string()
  .min(1, "File key is required")
  .max(512, "File key cannot exceed 512 characters");

export const claimAttachmentsSchema = z.object({
  fileKeys: z
    .array(fileKeySchema)
    .min(1, "Attach at least one file")
    // Matches the storage cap; anything more is rejected before it reaches the
    // database, where it would only be caught one query later.
    .max(10, "Cannot claim more than 10 files at once"),
  // Present when the evidence belongs to a specific pending proposal rather than
  // to the complaint as a whole.
  transitionRequestId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid request id")
    .optional(),
});

export const attachmentIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid attachment id"),
});
