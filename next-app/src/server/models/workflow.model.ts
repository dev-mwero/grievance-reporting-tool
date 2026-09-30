import mongoose, { type Document, Schema } from "mongoose";
import {
  type ISoftDeletable,
  softDeleteFields,
  softDeleteIndex,
} from "./soft-delete";

/**
 * A stage is a step a complaint passes through. `key` is the stable identity
 * used by grievance records and the transition table, while `label` is the
 * human-facing name shown throughout the UI — so renaming a stage to
 * "Under Investigation" never invalidates the complaints sitting on it.
 */
export interface IWorkflowStage {
  key: string;
  label: string;
  description?: string;
  /** Terminal stages end a complaint; a complaint on one needs a reopen. */
  isFinal: boolean;
  /** Freeform colour token, e.g. "amber". Drives the stage badge. */
  color?: string;
  order: number;
  /**
   * Where the admin left this box on the builder canvas. Presentation only —
   * the cycle does not depend on it, so a stage without a stored position
   * simply gets laid out automatically.
   */
  position?: { x: number; y: number };
}

/**
 * A rule permitting one specific move between two stages. Deliberately not a
 * bare (from, to) pair: `requiresApproval` is what lets a complaint sit in a
 * stage while an admin reviews a proposed move, and `requiresReason` is the
 * audit trail's minimum viable entry.
 */
export interface IWorkflowTransition {
  from: string;
  to: string;
  /** The verb shown on the action button, e.g. "Escalate", "Request info". */
  actionLabel: string;
  /** Roles permitted to make this move. Empty would mean nobody — guarded. */
  allowedRoles: string[];
  /**
   * Staff proposing this move parks it as a pending request for an admin to
   * approve, rather than applying it immediately.
   */
  requiresApproval: boolean;
  requiresReason: boolean;
  requiresAttachment: boolean;
}

export interface IWorkflow extends Document, ISoftDeletable {
  name: string;
  description?: string;
  /**
   * Absent for the global workflow. A workflow scoped to a category overrides
   * the global one for complaints in that category — see workflow.service.ts.
   */
  categoryId?: mongoose.Types.ObjectId;
  isGlobal: boolean;
  stages: IWorkflowStage[];
  transitions: IWorkflowTransition[];
  /** Exactly one stage has this. Seeded from the current status enum. */
  startStageKey: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const stageSchema = new Schema<IWorkflowStage>(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    isFinal: { type: Boolean, default: false },
    color: { type: String, trim: true },
    order: { type: Number, required: true },
    position: {
      type: { x: Number, y: Number },
      // Mongoose wants the sub-keys named to persist properly.
      _id: false,
    },
  },
  { _id: false },
);

const transitionSchema = new Schema<IWorkflowTransition>(
  {
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    actionLabel: { type: String, required: true, trim: true },
    // Defaults to STAFF: if an admin adds a move and forgets to scope it, the
    // move is proposable by the least-privileged role rather than by nobody.
    allowedRoles: {
      type: [String],
      default: ["STAFF"],
      validate: {
        validator: (roles: string[]) => roles.length > 0,
        message: "A transition must allow at least one role",
      },
    },
    requiresApproval: { type: Boolean, default: false },
    requiresReason: { type: Boolean, default: false },
    requiresAttachment: { type: Boolean, default: false },
  },
  { _id: false },
);

const workflowSchema = new Schema<IWorkflow>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    categoryId: { type: Schema.Types.ObjectId, ref: "GrievanceCategory" },
    isGlobal: { type: Boolean, default: false },
    stages: {
      type: [stageSchema],
      validate: {
        validator: (stages: IWorkflowStage[]) => stages.length > 0,
        message: "A workflow needs at least one stage",
      },
    },
    transitions: { type: [transitionSchema], default: [] },
    startStageKey: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    ...softDeleteFields,
  },
  {
    timestamps: true,
  },
);

// Only one global workflow may be active at a time, or complaint resolution
// would have to guess which one is authoritative. Enforced in workflow.service
// because a partial index cannot express "active and not deleted".
workflowSchema.index({ isGlobal: 1, isActive: 1 });
workflowSchema.index({ categoryId: 1, isActive: 1 });
workflowSchema.index(softDeleteIndex);

export const Workflow =
  (mongoose.models.Workflow as mongoose.Model<IWorkflow>) ||
  mongoose.model<IWorkflow>("Workflow", workflowSchema);
