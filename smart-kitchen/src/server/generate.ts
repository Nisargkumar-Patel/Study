/**
 * generate.ts — Shared grocery-list generation used by /api/grocery and
 * /api/sync so both endpoints produce identical, canonical output.
 *
 * Takes a MealPlan (with its persisted manualItems + checkedItems), runs the
 * scale → aggregate → delta pipeline, and shapes the result into the
 * IndexedDB GroceryItemRecord contract (stable `id`, `checked` applied from
 * the plan) so online fetches and the offline cache use identical records.
 */
import { Recipe, Inventory, Staple, User } from '@/models';
import { aggregateWeeklyRequirements } from './scaling';
import { buildGroceryList, type ManualItem } from './groceryEngine';

/**
 * Household size = number of ACTIVE members, so portions track who actually
 * lives (and eats) in the house right now. Falls back to HOUSEHOLD_SIZE (or 7)
 * when no members exist yet, e.g. before the first login.
 */
export async function getHouseholdSize(): Promise<number> {
  const active = await User.countDocuments({ active: true });
  if (active > 0) return active;
  return Number(process.env.HOUSEHOLD_SIZE || 7);
}

export interface ShapedGroceryItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  display: string;
  source: string;
  pantryCategory: string;
  checked: boolean;
  booleanItem: boolean;
  updatedAt: number;
}

interface PlanLike {
  dishes: string[];
  manualItems?: ManualItem[];
  checkedItems?: string[];
}

export async function generateGroceryForPlan(
  plan: PlanLike,
  extraManual: ManualItem[] = []
): Promise<ShapedGroceryItem[]> {
  const [recipes, inventory, staples, householdSize] = await Promise.all([
    Recipe.find({ name: { $in: plan.dishes } }).lean(),
    Inventory.find().lean(),
    Staple.find().lean(),
    getHouseholdSize(),
  ]);

  const required = aggregateWeeklyRequirements(recipes as never, householdSize);
  const manual = [...(plan.manualItems ?? []), ...extraManual];
  const list = buildGroceryList(required, inventory as never, staples as never, manual);

  const checked = new Set(plan.checkedItems ?? []);
  const now = Date.now();

  return list.map((g) => {
    const id = `${g.name}|${g.source}`;
    return {
      id,
      name: g.name,
      amount: g.amount,
      unit: g.unit,
      display: g.display,
      source: g.source,
      pantryCategory: g.pantryCategory,
      checked: checked.has(id),
      booleanItem: g.booleanItem,
      updatedAt: now,
    };
  });
}
