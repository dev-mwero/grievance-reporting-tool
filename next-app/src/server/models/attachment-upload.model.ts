import mongoose, { type Document, Schema } from "mongoose";

/**
 * A file that reached storage but is not yet attached to a complaint.
 *
 * UploadThing hands back a key the moment an upload completes, but a key alone
 * cannot be trusted from a client: anyone could claim any key. Recording the
 * upload server-side, at the one moment the app genuinely knows it happened, is
 * what makes the later claim verifiable — it can be looked up by key in constant
 * time and compared against the account that actually performed the upload,
 * rather than scanning the whole bucket hoping to find a match.
 */
export interface IPendingUpload extends Document {
  fileKey: string;
  name: string;
  size: number;
  contentType: string;
  uploadedBy: mongoose.Types.ObjectId;
  /** Set once an attachment record claims this upload. */
  claimedAt?: Date;
  claimedByGrievanceId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const pendingUploadSchema = new Schema<IPendingUpload>(
  {
    fileKey: {
      type: String,
      required: true,
      unique: true,
      maxlength: [512, "File key cannot exceed 512 characters"],
    },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    contentType: { type: String, required: true },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    claimedAt: Date,
    claimedByGrievanceId: { type: Schema.Types.ObjectId, ref: "Grievance" },
  },
  { timestamps: true },
);

// Reclaiming abandoned uploads: files uploaded but never attached to a complaint.
pendingUploadSchema.index({ claimedAt: 1, createdAt: 1 });

export const PendingUpload =
  (mongoose.models.PendingUpload as mongoose.Model<IPendingUpload>) ||
  mongoose.model<IPendingUpload>("PendingUpload", pendingUploadSchema);
