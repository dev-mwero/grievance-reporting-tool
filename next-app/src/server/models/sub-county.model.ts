import mongoose, { type Document, Schema } from "mongoose";

export interface ISubCounty extends Document {
  name: string;
  code: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subCountySchema = new Schema<ISubCounty>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    code: {
      type: String,
      required: [true, "Code is required"],
      unique: true,
      trim: true,
      maxlength: [50, "Code cannot exceed 50 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

subCountySchema.index({ isActive: 1 });

export const SubCounty =
  (mongoose.models.SubCounty as mongoose.Model<ISubCounty>) ||
  mongoose.model<ISubCounty>("SubCounty", subCountySchema);
