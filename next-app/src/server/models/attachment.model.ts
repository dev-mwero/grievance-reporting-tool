import mongoose, { type Document, Schema } from "mongoose";

export interface IAttachment extends Document {
  grievanceId: mongoose.Types.ObjectId;
  /** Set when the file arrived as evidence for a proposed move. */
  transitionRequestId?: mongoose.Types.ObjectId;
  /**
   * UploadThing's file key. The URL is never stored: for a private file it
   * expires, so a stored link would be a link that silently stops working.
   */
  fileKey: string;
  name: string;
  size: number;
  contentType: string;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedByName: string;
  createdAt: Date;
}

const attachmentSchema = new Schema<IAttachment>(
  {
    grievanceId: {
      type: Schema.Types.ObjectId,
      ref: "Grievance",
      required: [true, "Complaint is required"],
    },
    transitionRequestId: {
      type: Schema.Types.ObjectId,
      ref: "TransitionRequest",
    },
    fileKey: {
      type: String,
      required: [true, "File key is required"],
      // A key is a UUID plus a sanitised original filename, so this is a
      // backstop against a malformed client payload, not the primary check.
      maxlength: [512, "File key cannot exceed 512 characters"],
    },
    name: {
      type: String,
      required: [true, "File name is required"],
      maxlength: [255, "File name cannot exceed 255 characters"],
    },
    size: {
      type: Number,
      required: true,
      min: [0, "File size cannot be negative"],
    },
    contentType: {
      type: String,
      required: true,
      maxlength: [255, "Content type cannot exceed 255 characters"],
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Uploader is required"],
    },
    uploadedByName: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

/**
 * Listing a complaint's evidence is the only read this collection serves, and it
 * always reads in upload order.
 *
 * This compound index also serves the count query, so there is deliberately no
 * standalone `{ grievanceId }` index — it would be a strict prefix of this one
 * and cost a write on every attachment for nothing.
 */
attachmentSchema.index({ grievanceId: 1, createdAt: 1 });

export const Attachment =
  (mongoose.models.Attachment as mongoose.Model<IAttachment>) ||
  mongoose.model<IAttachment>("Attachment", attachmentSchema);

/**
 * File types accepted as complaint evidence.
 *
 * Kept here as well as in the upload route: the route stops a bad file from
 * reaching storage, while this is what the API trusts when a client claims an
 * attachment is attached. A client can lie about anything, so the same allow-list
 * has to exist on both sides.
 */
export const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_GRIEVANCE = 10;
