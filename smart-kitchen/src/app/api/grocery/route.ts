/**
 * GET  /api/grocery?week=YYYY-MM-DD
 *   Generate the deduplicated grocery list for a week by running the full
 *   pipeline: scale recipes -> aggregate -> subtract inventory -> add staple
 *   deltas -> append the plan's persisted manual items.
 *
 * POST /api/grocery   { week, manualItems: [...] }
 *   Persists the supplied ad-hoc manual items onto the week's meal plan (so
 *   they survive regeneration and sync across devices), then generates.
 *
 * If `week` is omitted we pick the meal plan whose range contains today, else
 * the most recent plan.
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { MealPlan } from '@/models';
import { generateGroceryForPlan } from '@/server/generate';
import type { ManualItem } from '@/server/groceryEngine';

// DB-backed: never statically prerender at build time.
export const dynamic = 'force-dynamic';

async function resolveMealPlan(weekParam: string | null) {
  if (weekParam) {
    return MealPlan.findOne({ weekStart: new Date(weekParam) });
  }
  const now = new Date();
  const current = await MealPlan.findOne({
    weekStart: { $lte: now },
    weekEnd: { $gte: now },
  });
  if (current) return current;
  return MealPlan.findOne().sort({ weekStart: -1 });
}

export async function GET(req: NextRequest) {
  await connectDB();
  const plan = await resolveMealPlan(req.nextUrl.searchParams.get('week'));
  if (!plan) {
    return NextResponse.json({ groceryList: [], week: null, error: 'No meal plan found' });
  }
  const groceryList = await generateGroceryForPlan(plan.toObject());
  return NextResponse.json({
    week: { weekStart: plan.weekStart, weekEnd: plan.weekEnd, dishes: plan.dishes },
    groceryList,
  });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json().catch(() => ({}));
  const plan = await resolveMealPlan(body.week ?? null);
  if (!plan) {
    return NextResponse.json({ groceryList: [], week: null, error: 'No meal plan found' });
  }

  // Persist new manual items onto the plan (dedupe by name, case-insensitive).
  const incoming: ManualItem[] = Array.isArray(body.manualItems) ? body.manualItems : [];
  if (incoming.length > 0) {
    const existing = new Set(plan.manualItems.map((m) => m.name.toLowerCase()));
    for (const m of incoming) {
      const name = String(m.name || '').trim();
      if (name && !existing.has(name.toLowerCase())) {
        plan.manualItems.push({
          name,
          amount: Number(m.amount ?? 1),
          unit: (m.unit as 'g' | 'ml' | 'pcs') || 'pcs',
          pantryCategory: m.pantryCategory || 'Other',
        });
        existing.add(name.toLowerCase());
      }
    }
    await plan.save();
  }

  const groceryList = await generateGroceryForPlan(plan.toObject());
  return NextResponse.json({
    week: { weekStart: plan.weekStart, weekEnd: plan.weekEnd, dishes: plan.dishes },
    groceryList,
  });
}
