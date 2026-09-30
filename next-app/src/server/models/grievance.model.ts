import crypto from "node:crypto";
import mongoose, { type Document, Schema } from "mongoose";
import {
  type ISoftDeletable,
  softDeleteFields,
  softDeleteIndex,
} from "./soft-delete";

export interface IGrievance extends Document, ISoftDeletable {
  referenceCode: string;
  subCountyId: mongoose.Types.ObjectId;
  wardId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  subCountyName: string;
  wardName: string;
  categoryName: string;
  description: string;
  /**
   * A workflow stage key, not a member of the legacy enum. The set of valid keys
   * is whatever the governing workflow defines, so this is deliberately a free
   * string and is validated in the service layer against the workflow.
   */
  status: string;
  /**
   * The workflow that governed this complaint at submission. Pinned so that
   * later edits to a workflow cannot retroactively change how a case already in
   * flight is expected to progress.
   */
  workflowId?: mongoose.Types.ObjectId;
  primaryAssigneeId?: mongoose.Types.ObjectId;
  supportingAssignees: mongoose.Types.ObjectId[];
  submittedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

function generateReferenceCode(): string {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `GRV-${year}-${random}`;
}

const grievanceSchema = new Schema<IGrievance>(
  {
    referenceCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: generateReferenceCode,
    },
    subCountyId: {
      type: Schema.Types.ObjectId,
      ref: "SubCounty",
      required: [true, "Sub-County is required"],
    },
    wardId: {
      type: Schema.Types.ObjectId,
      ref: "Ward",
      required: [true, "Ward is required"],
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "GrievanceCategory",
      required: [true, "Category is required"],
    },
    subCountyName: { type: String, required: true },
    wardName: { type: String, required: true },
    categoryName: { type: String, required: true },
    description: {
      type: String,
      required: [true, "Description is required"],
      maxlength: [20000, "Description cannot exceed 20000 characters"],
    },
    status: {
      // Intentionally not enum-constrained: stage keys are user-defined. Kept
      // required with no default so a complaint can never be created without an
      // explicit starting stage from its workflow.
      type: String,
      required: true,
    },
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workflow",
    },
    primaryAssigneeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    supportingAssignees: [{ type: Schema.Types.ObjectId, ref: "User" }],
    submittedAt: { type: Date, default: Date.now },
    acknowledgedAt: { type: Date },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    ...softDeleteFields,
  },
  {
    timestamps: true,
  },
);

grievanceSchema.index({ status: 1, createdAt: -1 });
grievanceSchema.index({ subCountyId: 1, status: 1 });
grievanceSchema.index({ wardId: 1, status: 1 });
grievanceSchema.index({ categoryId: 1, status: 1 });
grievanceSchema.index({ primaryAssigneeId: 1, status: 1 });
grievanceSchema.index({ supportingAssignees: 1 });
grievanceSchema.index({ createdAt: -1 });
grievanceSchema.index(softDeleteIndex);

export const Grievance =
  (mongoose.models.Grievance as mongoose.Model<IGrievance>) ||
  mongoose.model<IGrievance>("Grievance", grievanceSchema);
