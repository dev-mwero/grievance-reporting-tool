import mongoose, { type Document, Schema } from "mongoose";

export interface IPasswordResetToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const passwordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    token: {
      type: String,
      required: [true, "Token is required"],
      unique: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiry date is required"],
    },
    usedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken =
  (mongoose.models.PasswordResetToken as mongoose.Model<IPasswordResetToken>) ||
  mongoose.model<IPasswordResetToken>(
    "PasswordResetToken",
    passwordResetTokenSchema,
  );
