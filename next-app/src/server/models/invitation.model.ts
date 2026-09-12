import mongoose, { type Document, Schema } from "mongoose";
import { Role } from "@/types";

export interface IInvitation extends Document {
  email: string;
  name: string;
  phone?: string;
  title?: string;
  role: Role;
  token: string;
  invitedBy: mongoose.Types.ObjectId;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<IInvitation>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      maxlength: [254, "Email cannot exceed 254 characters"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone cannot exceed 20 characters"],
    },
    title: {
      type: String,
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    role: {
      type: String,
      enum: Object.values(Role),
      required: [true, "Role is required"],
    },
    token: {
      type: String,
      required: [true, "Token is required"],
      unique: true,
      select: false,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Inviter is required"],
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiry date is required"],
    },
    acceptedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Invitation =
  (mongoose.models.Invitation as mongoose.Model<IInvitation>) ||
  mongoose.model<IInvitation>("Invitation", invitationSchema);
