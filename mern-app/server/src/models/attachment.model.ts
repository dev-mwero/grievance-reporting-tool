import mongoose, { Schema, type Document } from 'mongoose';

export interface IAttachment extends Document {
  grievanceId: mongoose.Types.ObjectId;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url?: string;
  uploadedBy?: mongoose.Types.ObjectId;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<IAttachment>(
  {
    grievanceId: {
      type: Schema.Types.ObjectId,
      ref: 'Grievance',
      required: [true, 'Grievance ID is required'],
    },
    originalName: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true,
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
    },
    size: {
      type: Number,
      required: [true, 'File size is required'],
      min: [0, 'File size cannot be negative'],
    },
    storageKey: {
      type: String,
      required: [true, 'Storage key is required'],
      unique: true,
    },
    url: {
      type: String,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      // null for anonymous uploads
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for querying attachments by grievance
attachmentSchema.index({ grievanceId: 1, uploadedAt: -1 });

export const Attachment = mongoose.model<IAttachment>('Attachment', attachmentSchema);
