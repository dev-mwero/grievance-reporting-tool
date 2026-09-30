import mongoose, { type Document, Schema } from "mongoose";

/**
 * Where a proposal is in its life.
 *
 * `SUPERSEDED` is not a decision — it records that the complaint moved on before
 * anyone reviewed this request, so the proposal can no longer be applied. It is
 * kept distinct from `REJECTED` because the distinction matters when reading the
 * record later: nobody judged it, the world simply moved.
 */
export type TransitionRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN"
  | "SUPERSEDED";

export interface ITransitionRequest extends Document {
  grievanceId: mongoose.Types.ObjectId;
  /** Denormalised so an approval queue can render without a join per row. */
  referenceCode: string;
  workflowId?: mongoose.Types.ObjectId;
  /** The stage the complaint sat in when the move was proposed. */
  fromStage: string;
  toStage: string;
  /**
   * Snapshot of the move's label at proposal time. Copied rather than joined so
   * the queue shows what the proposer was actually asking for, even if an admin
   * later renames the move in the builder.
   */
  actionLabel: string;
  proposedBy: mongoose.Types.ObjectId;
  proposedByName: string;
  reason: string;
  status: TransitionRequestStatus;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedByName?: string;
  reviewedAt?: Date;
  /** An admin's note when declining, or the proposer's reason when withdrawing. */
  decisionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const transitionRequestSchema = new Schema<ITransitionRequest>(
  {
    grievanceId: {
      type: Schema.Types.ObjectId,
      ref: "Grievance",
      required: [true, "Grievance is required"],
      index: true,
    },
    referenceCode: {
      type: String,
      required: true,
    },
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: "Workflow",
    },
    fromStage: {
      type: String,
      required: true,
    },
    toStage: {
      type: String,
      required: true,
    },
    actionLabel: {
      type: String,
      required: true,
      maxlength: [100, "Action label cannot exceed 100 characters"],
    },
    proposedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Proposer is required"],
    },
    proposedByName: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: [true, "A reason is required"],
      trim: true,
      maxlength: [2000, "Reason cannot exceed 2000 characters"],
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN", "SUPERSEDED"],
      default: "PENDING",
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedByName: String,
    reviewedAt: Date,
    decisionNote: {
      type: String,
      trim: true,
      maxlength: [2000, "Note cannot exceed 2000 characters"],
    },
  },
  { timestamps: true },
);

// The admin queue: pending first, oldest first.
transitionRequestSchema.index({ status: 1, createdAt: -1 });

// Per-complaint history.
transitionRequestSchema.index({ grievanceId: 1, createdAt: -1 });

/**
 * At most one pending request per complaint, enforced by the database rather
 * than by a check-then-insert in the service.
 *
 * Two staff proposing different moves at the same moment would race past an
 * application-level check and leave two pending requests that contradict each
 * other, with no defined winner. A unique partial index makes the second write
 * fail instead, which is the honest outcome.
 */
transitionRequestSchema.index(
  { grievanceId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "PENDING" },
    name: "one_pending_request_per_grievance",
  },
);

export const TransitionRequest =
  (mongoose.models.TransitionRequest as mongoose.Model<ITransitionRequest>) ||
  mongoose.model<ITransitionRequest>(
    "TransitionRequest",
    transitionRequestSchema,
  );
