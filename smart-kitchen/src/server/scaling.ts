/**
 * scaling.ts — Dynamic Portion Scaling Algorithm.
 *
 * Each recipe is authored for `baseServings` people. To feed the household we
 * apply a multiplier of `householdSize / baseServings` to every ingredient.
 * The household size is derived from the number of ACTIVE members (see
 * generate.ts) so the app works for any house, not a fixed count; the
 * HOUSEHOLD_SIZE env var is only a fallback before the first member exists.
 *
 *   e.g. a Dal Fry authored for 4 people, scaled for a house of 7:
 *        multiplier = 7 / 4 = 1.75
 *        300 g toor dal  ->  525 g
 *
 * Spices (boolean category) are NOT scaled by quantity — you either have the
 * spice or you don't — so we carry them through untouched for the grocery
 * engine to handle via in-stock booleans.
 */
import { BaseUnit } from '@/lib/units';
import type { RecipeDoc } from '@/models/Recipe';

export const HOUSEHOLD_SIZE = Number(process.env.HOUSEHOLD_SIZE || 7);

export interface ScaledIngredient {
  name: string;
  amount: number; // scaled, in base unit
  unit: BaseUnit;
  pantryCategory: string;
  isSpice: boolean;
}

/**
 * Scale a single recipe's ingredients to the household size.
 */
export function scaleRecipe(
  recipe: Pick<RecipeDoc, 'baseServings' | 'ingredients'>,
  householdSize: number = HOUSEHOLD_SIZE
): ScaledIngredient[] {
  const multiplier = householdSize / recipe.baseServings;

  return recipe.ingredients.map((ing) => {
    const isSpice = ing.pantryCategory === 'Spices';
    return {
      name: ing.name,
      // Spices keep their nominal amount; quantity is irrelevant for them.
      amount: isSpice ? ing.baseAmount : ing.baseAmount * multiplier,
      unit: ing.baseUnit as BaseUnit,
      pantryCategory: ing.pantryCategory,
      isSpice,
    };
  });
}

/**
 * Aggregate scaled ingredients across an entire week's worth of dishes into a
 * single deduplicated requirement map keyed by `name|unit`.
 *
 * Two ingredients only combine if they share BOTH name and base unit, which is
 * guaranteed safe because everything was normalized upstream.
 */
export function aggregateWeeklyRequirements(
  recipes: Array<Pick<RecipeDoc, 'baseServings' | 'ingredients'>>,
  householdSize: number = HOUSEHOLD_SIZE
): Map<string, ScaledIngredient> {
  const required = new Map<string, ScaledIngredient>();

  for (const recipe of recipes) {
    for (const scaled of scaleRecipe(recipe, householdSize)) {
      const key = `${scaled.name.toLowerCase()}|${scaled.unit}`;
      const existing = required.get(key);
      if (existing) {
        // Spices stay boolean; measured items sum their amounts.
        existing.amount = existing.isSpice
          ? existing.amount
          : existing.amount + scaled.amount;
      } else {
        required.set(key, { ...scaled });
      }
    }
  }

  return required;
}
