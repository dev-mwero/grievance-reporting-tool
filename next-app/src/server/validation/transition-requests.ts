import { z } from "zod";

export const proposeTransitionSchema = z.object({
  to: z.string().min(1, "Choose the stage to move to").max(100),
  // Always required: a proposal with no explanation gives an admin nothing to
  // judge it on, which makes the approval step theatre.
  reason: z
    .string()
    .trim()
    .min(1, "A reason is required")
    .max(2000, "Reason cannot exceed 2000 characters"),
  // Keys of files the caller has already uploaded, attached to the complaint as
  // part of the proposal. The service verifies each against its own record of
  // who uploaded it, so these are claims to check, not filenames to trust.
  attachmentKeys: z
    .array(z.string().min(1).max(512))
    .max(10, "Cannot attach more than 10 files")
    .optional(),
});

export type ProposeTransitionInput = z.infer<typeof proposeTransitionSchema>;

export const reviewTransitionSchema = z.object({
  note: z
    .string()
    .trim()
    .max(2000, "Note cannot exceed 2000 characters")
    .optional(),
});

export type ReviewTransitionInput = z.infer<typeof reviewTransitionSchema>;

export const listTransitionRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(["PENDING", "APPROVED", "REJECTED", "WITHDRAWN", "SUPERSEDED"])
    .optional(),
});

export type ListTransitionRequestsQuery = z.infer<
  typeof listTransitionRequestsQuerySchema
>;
