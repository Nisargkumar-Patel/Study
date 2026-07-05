/**
 * MealPlan model — one week of dinners plus the computed cooking-duty rotation.
 *
 * `weekStart`/`weekEnd` come straight from the seed dinner schedule. `dishes` is
 * an ordered list of recipe names for that week. `rotation` maps each cooking day
 * to the assigned housemate so SNS reminders can be dispatched.
 */
import { Schema, model, models, Model, InferSchemaType, Types } from 'mongoose';

const RotationEntrySchema = new Schema(
  {
    date: { type: Date, required: true },
    dish: { type: String, required: true },
    cook: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cookName: { type: String, required: true }, // denormalized for fast display
    reminderSentAt: { type: Date, default: null },
  },
  { _id: false }
);

const ManualItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, default: 1, min: 0 },
    unit: { type: String, enum: ['g', 'ml', 'pcs'], default: 'pcs' },
    pantryCategory: { type: String, default: 'Other' },
  },
  { _id: false }
);

const MealPlanSchema = new Schema(
  {
    weekStart: { type: Date, required: true, unique: true },
    weekEnd: { type: Date, required: true },

    // Ordered dish names planned for the week (references Recipe.name).
    dishes: { type: [String], default: [] },

    // Resolved day-wise cooking duty rotation across the 7 housemates.
    rotation: { type: [RotationEntrySchema], default: [] },

    // Ad-hoc one-off grocery additions for this week. Persisted on the plan so
    // they survive list regeneration and sync across housemates' devices.
    manualItems: { type: [ManualItemSchema], default: [] },

    // Grocery line ids ("name|source") checked off in the store. Persisted so
    // an offline sync doesn't wipe a shopper's progress.
    checkedItems: { type: [String], default: [] },

    status: {
      type: String,
      enum: ['draft', 'active', 'completed'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

export type MealPlanDoc = InferSchemaType<typeof MealPlanSchema> & { _id: Types.ObjectId };

export const MealPlan: Model<MealPlanDoc> =
  (models.MealPlan as Model<MealPlanDoc>) ||
  model<MealPlanDoc>('MealPlan', MealPlanSchema);

export default MealPlan;
