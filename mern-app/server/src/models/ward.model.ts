import mongoose, { Schema, type Document } from 'mongoose';

export interface IWard extends Document {
  name: string;
  code: string;
  subCountyId: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const wardSchema = new Schema<IWard>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    code: {
      type: String,
      required: [true, 'Code is required'],
      trim: true,
      maxlength: [50, 'Code cannot exceed 50 characters'],
    },
    subCountyId: {
      type: Schema.Types.ObjectId,
      ref: 'SubCounty',
      required: [true, 'Sub-County is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: ward code must be unique within a sub-county
wardSchema.index({ subCountyId: 1, code: 1 }, { unique: true });
// Index for cascading queries (get all wards for a sub-county)
wardSchema.index({ subCountyId: 1, isActive: 1 });

export const Ward = mongoose.model<IWard>('Ward', wardSchema);
