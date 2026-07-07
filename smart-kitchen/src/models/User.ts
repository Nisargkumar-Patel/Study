/**
 * User model — one housemate. The household can be any size; the portion
 * scaler and rotation solver both derive their math from the count of active
 * members, not a fixed number.
 *
 * Used by the rotation solver (cooking duty) and the AWS SNS reminder dispatch
 * (phone number is the SMS target).
 */
import { Schema, model, models, Model, InferSchemaType } from 'mongoose';

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: {
      type: String,
      required: true,
      // E.164 format expected by AWS SNS, e.g. +14155550123
      match: [/^\+[1-9]\d{6,14}$/, 'Phone must be E.164 format, e.g. +14155550123'],
    },
    email: { type: String, lowercase: true, trim: true },
    // Stable slot used to seed the deterministic rotation order. Any number of
    // housemates is supported; new members take the next free slot.
    rotationSlot: {
      type: Number,
      required: true,
      min: 0,
      unique: true,
    },
    // Per-user opt-out so someone away that week can be skipped by the solver.
    active: { type: Boolean, default: true },
    notifyBySms: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof UserSchema>;

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) || model<UserDoc>('User', UserSchema);

export default User;
