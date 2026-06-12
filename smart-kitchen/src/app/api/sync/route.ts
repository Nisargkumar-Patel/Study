/**
 * POST /api/sync   { mutations: QueuedMutation[] }
 *
 * Reconcile a batch of offline IndexedDB mutations into MongoDB, then return the
 * freshly-regenerated canonical grocery list so the client can overwrite its
 * local cache (last-write-wins).
 *
 * Supported mutation types:
 *   - TOGGLE_SPICE  { name, inStock }       -> Inventory.inStock
 *   - UPDATE_AMOUNT { name, baseAmount, baseUnit, pantryCategory }
 *                                            -> Inventory measured amount
 *   - ADD_MANUAL    { name, amount, unit }   -> recorded as inventory addition
 *   - CHECK_ITEM    { name, checked }        -> when checked, treat as purchased
 *                                              (acknowledged; UI-only state)
 *
 * Each mutation is idempotent at the item level, so replaying the same queue
 * twice converges to the same state.
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Inventory, Recipe, Staple, MealPlan } from '@/models';
import { aggregateWeeklyRequirements } from '@/server/scaling';
import { buildGroceryList } from '@/server/groceryEngine';

// DB-backed: never statically prerender at build time.
export const dynamic = 'force-dynamic';

interface Mutation {
  type: 'TOGGLE_SPICE' | 'UPDATE_AMOUNT' | 'ADD_MANUAL' | 'CHECK_ITEM';
  payload: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json().catch(() => ({}));
  const mutations: Mutation[] = Array.isArray(body.mutations) ? body.mutations : [];

  let conflicts = 0;

  for (const m of mutations) {
    const p = m.payload || {};
    const name = String(p.name || '').trim();
    if (!name) {
      conflicts += 1;
      continue;
    }

    try {
      switch (m.type) {
        case 'TOGGLE_SPICE':
          await Inventory.updateOne(
            { name },
            {
              $set: { inStock: Boolean(p.inStock), lastUpdatedBy: 'offline-sync' },
              $setOnInsert: { pantryCategory: 'Spices', baseUnit: 'g' },
            },
            { upsert: true }
          );
          break;

        case 'UPDATE_AMOUNT':
        case 'ADD_MANUAL':
          await Inventory.updateOne(
            { name },
            {
              $set: {
                baseAmount: Number(p.baseAmount ?? p.amount ?? 0),
                lastUpdatedBy: 'offline-sync',
              },
              $setOnInsert: {
                baseUnit: String(p.unit || p.baseUnit || 'pcs'),
                pantryCategory: String(p.pantryCategory || 'Other'),
              },
            },
            { upsert: true }
          );
          break;

        case 'CHECK_ITEM':
          // Checked-off items are UI state; nothing authoritative to persist.
          break;

        default:
          conflicts += 1;
      }
    } catch {
      conflicts += 1;
    }
  }

  // ---- Regenerate the canonical grocery list -----------------------------
  const now = new Date();
  const plan =
    (await MealPlan.findOne({ weekStart: { $lte: now }, weekEnd: { $gte: now } }).lean()) ||
    (await MealPlan.findOne().sort({ weekStart: -1 }).lean());

  let groceryList: ReturnType<typeof buildGroceryList> = [];
  if (plan) {
    const [recipes, inventory, staples] = await Promise.all([
      Recipe.find({ name: { $in: plan.dishes } }).lean(),
      Inventory.find().lean(),
      Staple.find().lean(),
    ]);
    const required = aggregateWeeklyRequirements(recipes as never);
    groceryList = buildGroceryList(required, inventory as never, staples as never, []);
  }

  // Shape the list to match the IndexedDB GroceryItemRecord contract.
  const shaped = groceryList.map((g) => ({
    id: `${g.name}|${g.source}`,
    name: g.name,
    amount: g.amount,
    unit: g.unit,
    display: g.display,
    source: g.source,
    pantryCategory: g.pantryCategory,
    checked: g.checked,
    booleanItem: g.booleanItem,
    updatedAt: Date.now(),
  }));

  return NextResponse.json({ groceryList: shaped, conflicts, applied: mutations.length });
}
