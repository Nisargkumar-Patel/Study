/**
 * GET  /api/grocery?week=YYYY-MM-DD
 *   Generate the deduplicated grocery list for a week by running the full
 *   pipeline: scale recipes -> aggregate -> subtract inventory -> add staple
 *   deltas -> append manual items.
 *
 * POST /api/grocery   { week, manualItems: [...] }
 *   Same generation but with ad-hoc manual override additions supplied inline.
 *
 * If `week` is omitted we pick the meal plan whose range contains today, else
 * the most recent plan.
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Recipe, Inventory, Staple, MealPlan } from '@/models';
import { aggregateWeeklyRequirements } from '@/server/scaling';
import { buildGroceryList, type ManualItem } from '@/server/groceryEngine';

// DB-backed: never statically prerender at build time.
export const dynamic = 'force-dynamic';

async function resolveMealPlan(weekParam: string | null) {
  if (weekParam) {
    return MealPlan.findOne({ weekStart: new Date(weekParam) }).lean();
  }
  const now = new Date();
  const current = await MealPlan.findOne({
    weekStart: { $lte: now },
    weekEnd: { $gte: now },
  }).lean();
  if (current) return current;
  return MealPlan.findOne().sort({ weekStart: -1 }).lean();
}

async function generate(weekParam: string | null, manual: ManualItem[]) {
  await connectDB();

  const plan = await resolveMealPlan(weekParam);
  if (!plan) {
    return { groceryList: [], week: null, error: 'No meal plan found' };
  }

  // Load all recipes referenced by this week's dishes.
  const recipes = await Recipe.find({ name: { $in: plan.dishes } }).lean();
  const [inventory, staples] = await Promise.all([
    Inventory.find().lean(),
    Staple.find().lean(),
  ]);

  const required = aggregateWeeklyRequirements(recipes as never);
  const list = buildGroceryList(required, inventory as never, staples as never, manual);

  // Shape to the IndexedDB GroceryItemRecord contract (stable `id`) so the
  // online fetch and the offline cache use identical records.
  const groceryList = list.map((g) => ({
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

  return {
    week: { weekStart: plan.weekStart, weekEnd: plan.weekEnd, dishes: plan.dishes },
    groceryList,
  };
}

export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get('week');
  const result = await generate(week, []);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const manual: ManualItem[] = Array.isArray(body.manualItems) ? body.manualItems : [];
  const result = await generate(body.week ?? null, manual);
  return NextResponse.json(result);
}
