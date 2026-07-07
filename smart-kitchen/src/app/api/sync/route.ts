/**
 * POST /api/sync   { mutations: QueuedMutation[] }
 *
 * Reconcile a batch of offline IndexedDB mutations into MongoDB, then return
 * the freshly-regenerated canonical grocery list so the client can overwrite
 * its local cache (last-write-wins).
 *
 * Supported mutation types:
 *   - TOGGLE_SPICE  { name, inStock }        -> Inventory.inStock
 *   - UPDATE_AMOUNT { name, baseAmount, ... } -> Inventory measured amount
 *   - ADD_MANUAL    { name, amount, unit }    -> MealPlan.manualItems (a manual
 *       addition is something to BUY — it must never be written into pantry
 *       Inventory, or the delta engine would subtract it from the list)
 *   - CHECK_ITEM    { id, name, checked }     -> MealPlan.checkedItems, so a
 *       shopper's in-store progress survives sync and shows on every device
 *
 * Each mutation is idempotent at the item level, so replaying the same queue
 * twice converges to the same state.
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Inventory, MealPlan } from '@/models';
import { generateGroceryForPlan } from '@/server/generate';
import { getSession } from '@/lib/auth';

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

  // Attribute offline edits to the signed-in member for the audit trail.
  const session = await getSession(req);
  const editor = session?.name || 'offline-sync';

  // Resolve the active plan once — CHECK_ITEM / ADD_MANUAL mutate it.
  const now = new Date();
  const plan =
    (await MealPlan.findOne({ weekStart: { $lte: now }, weekEnd: { $gte: now } })) ||
    (await MealPlan.findOne().sort({ weekStart: -1 }));

  let conflicts = 0;
  let planDirty = false;

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
              $set: { inStock: Boolean(p.inStock), lastUpdatedBy: editor },
              $setOnInsert: { pantryCategory: 'Spices', baseUnit: 'g' },
            },
            { upsert: true }
          );
          break;

        case 'UPDATE_AMOUNT':
          await Inventory.updateOne(
            { name },
            {
              $set: {
                baseAmount: Number(p.baseAmount ?? p.amount ?? 0),
                lastUpdatedBy: editor,
              },
              $setOnInsert: {
                baseUnit: String(p.unit || p.baseUnit || 'pcs'),
                pantryCategory: String(p.pantryCategory || 'Other'),
              },
            },
            { upsert: true }
          );
          break;

        case 'ADD_MANUAL': {
          if (!plan) {
            conflicts += 1;
            break;
          }
          const exists = plan.manualItems.some(
            (mi) => mi.name.toLowerCase() === name.toLowerCase()
          );
          if (!exists) {
            plan.manualItems.push({
              name,
              amount: Number(p.amount ?? 1),
              unit: (String(p.unit || 'pcs') as 'g' | 'ml' | 'pcs'),
              pantryCategory: String(p.pantryCategory || 'Other'),
            });
            planDirty = true;
          }
          break;
        }

        case 'CHECK_ITEM': {
          if (!plan) {
            conflicts += 1;
            break;
          }
          const id = String(p.id || `${name}|recipe`);
          const idx = plan.checkedItems.indexOf(id);
          if (p.checked && idx === -1) {
            plan.checkedItems.push(id);
            planDirty = true;
          } else if (!p.checked && idx !== -1) {
            plan.checkedItems.splice(idx, 1);
            planDirty = true;
          }
          break;
        }

        default:
          conflicts += 1;
      }
    } catch {
      conflicts += 1;
    }
  }

  if (plan && planDirty) await plan.save();

  const groceryList = plan ? await generateGroceryForPlan(plan.toObject()) : [];

  return NextResponse.json({ groceryList, conflicts, applied: mutations.length });
}
