import { z } from "zod";
import { Role } from "@/types";
import { deletionScopeSchema } from "./common";

export const listWorkflowsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  deletionScope: deletionScopeSchema,
});

export type ListWorkflowsQuery = z.infer<typeof listWorkflowsQuerySchema>;

export const workflowStageSchema = z.object({
  key: z.string().min(1, "Stage key is required").max(100),
  label: z.string().min(1, "Stage label is required").max(200),
  description: z.string().max(1000).optional(),
  isFinal: z.boolean(),
  color: z.string().max(50).optional(),
  order: z.number().int().min(0),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

export type WorkflowStageInput = z.infer<typeof workflowStageSchema>;

export const workflowTransitionSchema = z.object({
  from: z.string().min(1, "A move must start at a stage").max(100),
  to: z.string().min(1, "A move must lead to a stage").max(100),
  actionLabel: z.string().min(1, "Action label is required").max(100),
  allowedRoles: z
    .array(z.nativeEnum(Role))
    .min(1, "A move must allow at least one role"),
  requiresApproval: z.boolean(),
  requiresReason: z.boolean(),
  requiresAttachment: z.boolean(),
  // A reopen is the only sanctioned way out of a final stage, so it is flagged
  // explicitly rather than inferred from the target stage. It is additionally
  // forced to admin-only when the graph is validated.
  isReopen: z.boolean().optional().default(false),
});

export type WorkflowTransitionInput = z.infer<typeof workflowTransitionSchema>;

export const createWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional(),
  categoryId: z.string().min(1).nullable().optional(),
  isGlobal: z.boolean(),
  stages: z.array(workflowStageSchema).min(1, "Add at least one stage"),
  transitions: z.array(workflowTransitionSchema),
  startStageKey: z.string().min(1, "Choose the stage complaints start at"),
  isActive: z.boolean(),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;

/**
 * Structural rules — reachability, a single start, no dead ends — are checked
 * against the merged result rather than the patch, since a partial update can
 * only be judged once combined with what is already stored.
 */
export const updateWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required").max(200).optional(),
  description: z.string().max(1000).optional(),
  categoryId: z.string().min(1).nullable().optional(),
  isGlobal: z.boolean().optional(),
  stages: z.array(workflowStageSchema).min(1).optional(),
  transitions: z.array(workflowTransitionSchema).optional(),
  startStageKey: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;

export const workflowParamsSchema = z.object({
  id: z.string().min(1, "Workflow ID is required"),
});

export type WorkflowParams = z.infer<typeof workflowParamsSchema>;
