import mongoose, { type Document, Schema } from "mongoose";

export type NotificationType =
  | "GRIEVANCE_SUBMITTED"
  | "GRIEVANCE_ASSIGNED"
  | "GRIEVANCE_STATUS_CHANGED"
  | "GRIEVANCE_UPDATE"
  | "SYSTEM";

export interface INotification extends Document {
  recipientId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  grievanceId?: mongoose.Types.ObjectId;
  referenceCode?: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required"],
      index: true,
    },
    type: {
      type: String,
      enum: [
        "GRIEVANCE_SUBMITTED",
        "GRIEVANCE_ASSIGNED",
        "GRIEVANCE_STATUS_CHANGED",
        "GRIEVANCE_UPDATE",
        "SYSTEM",
      ],
      required: [true, "Type is required"],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    grievanceId: {
      type: Schema.Types.ObjectId,
      ref: "Grievance",
    },
    referenceCode: {
      type: String,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, isRead: 1 });

export const Notification =
  (mongoose.models.Notification as mongoose.Model<INotification>) ||
  mongoose.model<INotification>("Notification", notificationSchema);
