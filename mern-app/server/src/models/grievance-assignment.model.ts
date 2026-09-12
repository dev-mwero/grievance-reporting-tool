import mongoose, { Schema, type Document } from 'mongoose';

export interface IGrievanceAssignment extends Document {
  grievanceId: mongoose.Types.ObjectId;
  assigneeId: mongoose.Types.ObjectId;
  assigneeName: string;
  assignedBy?: mongoose.Types.ObjectId;
  assignedByName?: string;
  isPrimary: boolean;
  assignedAt: Date;
  removedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const grievanceAssignmentSchema = new Schema<IGrievanceAssignment>(
  {
    grievanceId: {
      type: Schema.Types.ObjectId,
      ref: 'Grievance',
      required: [true, 'Grievance ID is required'],
    },
    assigneeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assignee ID is required'],
    },
    assigneeName: {
      type: String,
      required: [true, 'Assignee name is required'],
      trim: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedByName: {
      type: String,
      trim: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    removedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for querying assignments by grievance
grievanceAssignmentSchema.index({ grievanceId: 1, assignedAt: -1 });
// Index for querying assignments by user (staff dashboard)
grievanceAssignmentSchema.index({ assigneeId: 1, removedAt: 1 });
// Compound index for active assignments
grievanceAssignmentSchema.index({ grievanceId: 1, isPrimary: 1, removedAt: 1 });

export const GrievanceAssignment = mongoose.model<IGrievanceAssignment>(
  'GrievanceAssignment',
  grievanceAssignmentSchema
);
