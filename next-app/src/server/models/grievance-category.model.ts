import mongoose, { type Document, Schema } from "mongoose";
import {
  type ISoftDeletable,
  softDeleteFields,
  softDeleteIndex,
} from "./soft-delete";

export interface IGrievanceCategory extends Document, ISoftDeletable {
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const grievanceCategorySchema = new Schema<IGrievanceCategory>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      unique: true,
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    ...softDeleteFields,
  },
  {
    timestamps: true,
  },
);

grievanceCategorySchema.index({ isActive: 1 });
grievanceCategorySchema.index(softDeleteIndex);

export const GrievanceCategory =
  (mongoose.models.GrievanceCategory as mongoose.Model<IGrievanceCategory>) ||
  mongoose.model<IGrievanceCategory>(
    "GrievanceCategory",
    grievanceCategorySchema,
  );
