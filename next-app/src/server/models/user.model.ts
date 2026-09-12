import mongoose, { type Document, Schema } from "mongoose";
import { Role } from "@/types";

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  role: Role;
  title?: string;
  department?: string;
  isActive: boolean;
  passwordHash: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [254, "Email cannot exceed 254 characters"],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone cannot exceed 20 characters"],
    },
    role: {
      type: String,
      enum: Object.values(Role),
      required: [true, "Role is required"],
      default: Role.STAFF,
    },
    title: {
      type: String,
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    department: {
      type: String,
      trim: true,
      maxlength: [200, "Department cannot exceed 200 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
      select: false,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

userSchema.index({ role: 1, isActive: 1 });

export const User =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", userSchema);
