import mongoose, { Schema, type Document } from 'mongoose';
import { AuditAction, ActorType } from '../services/audit.service';

export interface IAuditLog extends Document {
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorId?: mongoose.Types.ObjectId;
  actorType: ActorType;
  actorName?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: [true, 'Action is required'],
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      trim: true,
    },
    entityId: {
      type: String,
      required: [true, 'Entity ID is required'],
      trim: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      // null for system/anonymous actions
    },
    actorType: {
      type: String,
      enum: Object.values(ActorType),
      required: [true, 'Actor type is required'],
      default: ActorType.SYSTEM,
    },
    actorName: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for entity history queries
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
// Index for actor activity queries
auditLogSchema.index({ actorId: 1, timestamp: -1 });
// Index for date range queries
auditLogSchema.index({ timestamp: -1 });
// TTL index: auto-delete audit logs after 2 years (63072000 seconds)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
