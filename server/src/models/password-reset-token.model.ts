import mongoose, { Schema, type Document } from 'mongoose';

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
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    token: {
      type: String,
      required: [true, 'Token is required'],
      unique: true,
      select: false, // Never return token by default
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    usedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for token lookup during reset
passwordResetTokenSchema.index({ token: 1 });
// Auto-delete expired tokens (TTL index)
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken = mongoose.model<IPasswordResetToken>(
  'PasswordResetToken',
  passwordResetTokenSchema
);
