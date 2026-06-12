/**
 * groceryEngine.ts — Deduplicated Grocery Delta Engine.
 *
 * Produces the final, mathematically-precise grocery list for a week:
 *
 *   Final Required = (Scaled Recipe Ingredients)
 *                  - (Current Pantry Inventory)
 *                  + (Staple Target - Staple Inventory)
 *                  + (Manual one-off additions)
 *
 * Rules enforced:
 *   1. All measured math happens in canonical base units (g/ml/pcs).
 *   2. "Spices" category bypasses subtraction entirely and is emitted as a
 *      boolean "need to buy?" line driven by the inventory `inStock` flag.
 *   3. Quantities are clamped at zero — you never need a negative amount.
 */
import { formatBase, type BaseUnit } from '@/lib/units';
import type { ScaledIngredient } from './scaling';
import type { InventoryDoc } from '@/models/Inventory';
import type { StapleDoc } from '@/models/Staple';

export interface GroceryLineItem {
  name: string;
  amount: number; // base-unit amount still needed (0 for boolean spice lines)
  unit: BaseUnit;
  display: string; // human-friendly, e.g. "1.5 kg"
  source: 'recipe' | 'staple' | 'manual' | 'spice';
  pantryCategory: string;
  checked: boolean; // for offline check-off in the store
  booleanItem: boolean; // true for spice/condiment boolean lines
}

export interface ManualItem {
  name: string;
  amount?: number;
  unit?: BaseUnit;
  pantryCategory?: string;
}

/**
 * Build the grocery list.
 *
 * @param required   Map<"name|unit", ScaledIngredient> from aggregateWeeklyRequirements
 * @param inventory  current pantry rows
 * @param staples    high-capacity staples with targets
 * @param manual     ad-hoc one-off additions appended by a user
 */
export function buildGroceryList(
  required: Map<string, ScaledIngredient>,
  inventory: InventoryDoc[],
  staples: StapleDoc[],
  manual: ManualItem[] = []
): GroceryLineItem[] {
  const list: GroceryLineItem[] = [];

  // Index inventory by lowercased name for O(1) lookups.
  const invByName = new Map<string, InventoryDoc>();
  for (const inv of inventory) invByName.set(inv.name.toLowerCase(), inv);

  // ---- 1. Recipe requirements minus pantry inventory ---------------------
  for (const req of required.values()) {
    const inv = invByName.get(req.name.toLowerCase());

    // (a) Boolean Spices & Condiments — bypass all unit subtraction.
    if (req.isSpice) {
      const haveIt = inv ? Boolean(inv.inStock) : false;
      if (!haveIt) {
        list.push({
          name: req.name,
          amount: 0,
          unit: req.unit,
          display: 'as needed',
          source: 'spice',
          pantryCategory: req.pantryCategory,
          checked: false,
          booleanItem: true,
        });
      }
      continue;
    }

    // (b) Measured item — subtract on-hand amount (same base unit only).
    const onHand =
      inv && inv.baseUnit === req.unit ? inv.baseAmount : 0;
    const stillNeed = Math.max(0, req.amount - onHand);

    if (stillNeed > 0) {
      list.push({
        name: req.name,
        amount: stillNeed,
        unit: req.unit,
        display: formatBase({ amount: stillNeed, unit: req.unit }),
        source: 'recipe',
        pantryCategory: req.pantryCategory,
        checked: false,
        booleanItem: false,
      });
    }
  }

  // ---- 2. Staple deltas (Target - Current) -------------------------------
  for (const staple of staples) {
    const delta = Math.max(0, staple.targetAmount - staple.currentAmount);
    if (delta > 0) {
      list.push({
        name: staple.name,
        amount: delta,
        unit: staple.baseUnit as BaseUnit,
        display: formatBase({ amount: delta, unit: staple.baseUnit as BaseUnit }),
        source: 'staple',
        pantryCategory: 'Staple',
        checked: false,
        booleanItem: false,
      });
    }
  }

  // ---- 3. Ad-hoc manual override additions -------------------------------
  for (const m of manual) {
    const unit = (m.unit || 'pcs') as BaseUnit;
    const amount = m.amount ?? 1;
    list.push({
      name: m.name,
      amount,
      unit,
      display: m.amount ? formatBase({ amount, unit }) : '—',
      source: 'manual',
      pantryCategory: m.pantryCategory || 'Other',
      checked: false,
      booleanItem: false,
    });
  }

  // Stable sort: group by category, then name, for a tidy in-store list.
  list.sort(
    (a, b) =>
      a.pantryCategory.localeCompare(b.pantryCategory) ||
      a.name.localeCompare(b.name)
  );

  return list;
}
