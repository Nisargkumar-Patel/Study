/**
 * Staple model — high-capacity household essentials that must always be topped
 * up to a target baseline sized for 7 people (Milk, Bread, Paper Towels, ...).
 *
 *   Staple Delta = targetAmount - currentAmount   (clamped at 0)
 *
 * Any positive delta is injected automatically into the weekly grocery list,
 * independent of the meal plan.
 */
import { Schema, model, models, Model, InferSchemaType } from 'mongoose';

const StapleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },

    // Weekly target baseline sized for the household (e.g. 8000 ml of milk).
    targetAmount: { type: Number, required: true, min: 0 },
    baseUnit: { type: String, enum: ['g', 'ml', 'pcs'], required: true },

    // Current stock on hand, same base unit as the target.
    currentAmount: { type: Number, default: 0, min: 0 },

    category: { type: String, default: 'Household' },
    lastUpdatedBy: { type: String, default: 'system' },
  },
  { timestamps: true }
);

export type StapleDoc = InferSchemaType<typeof StapleSchema>;

export const Staple: Model<StapleDoc> =
  (models.Staple as Model<StapleDoc>) || model<StapleDoc>('Staple', StapleSchema);

export default Staple;
