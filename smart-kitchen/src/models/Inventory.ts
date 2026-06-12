/**
 * Inventory model — current pantry stock, one row per distinct item.
 *
 * Measured items track `baseAmount` + `baseUnit` (g/ml/pcs). "Spices" category
 * items are tracked purely by the `inStock` boolean and ignore the amount.
 */
import { Schema, model, models, Model, InferSchemaType } from 'mongoose';
import { PANTRY_CATEGORIES } from './Recipe';

const InventorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    pantryCategory: { type: String, enum: PANTRY_CATEGORIES, default: 'Other' },

    // Measured quantity, always in a canonical base unit.
    baseAmount: { type: Number, default: 0, min: 0 },
    baseUnit: { type: String, enum: ['g', 'ml', 'pcs'], default: 'g' },

    // Boolean tracking for Spices/Condiments — bypasses subtraction math.
    inStock: { type: Boolean, default: true },

    // Audit trail for offline-sync conflict resolution (last-write-wins).
    lastUpdatedBy: { type: String, default: 'system' },
  },
  { timestamps: true }
);

export type InventoryDoc = InferSchemaType<typeof InventorySchema>;

export const Inventory: Model<InventoryDoc> =
  (models.Inventory as Model<InventoryDoc>) ||
  model<InventoryDoc>('Inventory', InventorySchema);

export default Inventory;
