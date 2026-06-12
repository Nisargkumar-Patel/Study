/**
 * Recipe model — a single dinner dish and its ingredient bill of materials.
 *
 * Key design points for the scaling algorithm:
 *  - `baseServings` records how many people the authored quantities feed.
 *  - Each ingredient stores `baseAmount` + `baseUnit` already normalized to a
 *    canonical base unit (g / ml / pcs) so the scaler never re-parses strings.
 *  - `pantryCategory` lets the grocery engine know whether an ingredient is a
 *    measured staple or a boolean "Spices" item that bypasses unit math.
 */
import { Schema, model, models, Model, InferSchemaType } from 'mongoose';

export const PANTRY_CATEGORIES = [
  'Produce',
  'Dairy',
  'Grains',
  'Legumes',
  'Spices', // boolean inStock tracking — bypasses subtraction math
  'Condiments',
  'Frozen',
  'Other',
] as const;

const IngredientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Canonical base quantity for `baseServings` people.
    baseAmount: { type: Number, required: true, min: 0 },
    baseUnit: { type: String, enum: ['g', 'ml', 'pcs'], required: true },
    pantryCategory: {
      type: String,
      enum: PANTRY_CATEGORIES,
      default: 'Other',
    },
  },
  { _id: false }
);

const RecipeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    // How many people the authored ingredient quantities feed. The scaler
    // multiplies every ingredient by (HOUSEHOLD_SIZE / baseServings).
    baseServings: { type: Number, required: true, min: 1, default: 4 },
    cuisine: { type: String, default: 'Indian' },
    ingredients: { type: [IngredientSchema], default: [] },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type RecipeDoc = InferSchemaType<typeof RecipeSchema>;

export const Recipe: Model<RecipeDoc> =
  (models.Recipe as Model<RecipeDoc>) || model<RecipeDoc>('Recipe', RecipeSchema);

export default Recipe;
