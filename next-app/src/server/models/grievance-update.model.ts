import mongoose, { type Document, Schema } from "mongoose";

export enum UpdateType {
  PUBLIC_UPDATE = "PUBLIC_UPDATE",
  INTERNAL_NOTE = "INTERNAL_NOTE",
}

export interface IGrievanceUpdate extends Document {
  grievanceId: mongoose.Types.ObjectId;
  type: UpdateType;
  content: string;
  authorId?: mongoose.Types.ObjectId;
  authorName: string;
  createdAt: Date;
  updatedAt: Date;
}

const grievanceUpdateSchema = new Schema<IGrievanceUpdate>(
  {
    grievanceId: {
      type: Schema.Types.ObjectId,
      ref: "Grievance",
      required: [true, "Grievance ID is required"],
    },
    type: {
      type: String,
      enum: Object.values(UpdateType),
      required: [true, "Update type is required"],
    },
    content: {
      type: String,
      required: [true, "Content is required"],
      maxlength: [5000, "Content cannot exceed 5000 characters"],
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    authorName: {
      type: String,
      required: [true, "Author name is required"],
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

grievanceUpdateSchema.index({ grievanceId: 1, createdAt: -1 });
grievanceUpdateSchema.index({ grievanceId: 1, type: 1, createdAt: -1 });

export const GrievanceUpdate =
  (mongoose.models.GrievanceUpdate as mongoose.Model<IGrievanceUpdate>) ||
  mongoose.model<IGrievanceUpdate>("GrievanceUpdate", grievanceUpdateSchema);
