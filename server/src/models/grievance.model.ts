import mongoose, { Schema, type Document } from 'mongoose';
import { GrievanceStatus } from 'shared';
import crypto from 'crypto';

export interface IGrievance extends Document {
  referenceCode: string;
  subCountyId: mongoose.Types.ObjectId;
  wardId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;

  // Snapshots for historical accuracy
  subCountyName: string;
  wardName: string;
  categoryName: string;

  description: string;
  status: GrievanceStatus;

  // Assignment
  primaryAssigneeId?: mongoose.Types.ObjectId;
  supportingAssignees: mongoose.Types.ObjectId[];

  // Timestamps for lifecycle
  submittedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generate a secure, unpredictable reference code.
 * Format: GRV-YYYY-XXXXXX (8 hex chars)
 */
function generateReferenceCode(): string {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
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
      ref: 'SubCounty',
      required: [true, 'Sub-County is required'],
    },
    wardId: {
      type: Schema.Types.ObjectId,
      ref: 'Ward',
      required: [true, 'Ward is required'],
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'GrievanceCategory',
      required: [true, 'Category is required'],
    },

    // Snapshots for historical accuracy
    subCountyName: {
      type: String,
      required: true,
    },
    wardName: {
      type: String,
      required: true,
    },
    categoryName: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [10000, 'Description cannot exceed 10000 characters'],
    },
    status: {
      type: String,
      enum: Object.values(GrievanceStatus),
      default: GrievanceStatus.SUBMITTED,
    },

    // Assignment
    primaryAssigneeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    supportingAssignees: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Lifecycle timestamps
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    acknowledgedAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
    closedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Critical indexes for query performance
grievanceSchema.index({ status: 1, createdAt: -1 });
grievanceSchema.index({ subCountyId: 1, status: 1 });
grievanceSchema.index({ wardId: 1, status: 1 });
grievanceSchema.index({ categoryId: 1, status: 1 });
grievanceSchema.index({ primaryAssigneeId: 1, status: 1 });
grievanceSchema.index({ supportingAssignees: 1 });
grievanceSchema.index({ createdAt: -1 });

export const Grievance = mongoose.model<IGrievance>('Grievance', grievanceSchema);
