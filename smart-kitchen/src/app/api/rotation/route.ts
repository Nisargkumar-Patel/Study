/**
 * /api/rotation — view & (re)solve the cooking-duty rotation for a week.
 *
 * GET  ?week=YYYY-MM-DD  -> the stored rotation for that week (or current week).
 * POST { week }          -> recompute the rotation deterministically and persist.
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User, MealPlan } from '@/models';
import { solveRotation, toSolverHousemates } from '@/server/rotation';
import type { Types } from 'mongoose';

// DB-backed: never statically prerender at build time.
export const dynamic = 'force-dynamic';

async function findPlan(weekParam: string | null) {
  if (weekParam) return MealPlan.findOne({ weekStart: new Date(weekParam) });
  const now = new Date();
  return (
    (await MealPlan.findOne({ weekStart: { $lte: now }, weekEnd: { $gte: now } })) ||
    MealPlan.findOne().sort({ weekStart: -1 })
  );
}

export async function GET(req: NextRequest) {
  await connectDB();
  const plan = await findPlan(req.nextUrl.searchParams.get('week'));
  if (!plan) return NextResponse.json({ rotation: [] });
  return NextResponse.json({
    week: { weekStart: plan.weekStart, weekEnd: plan.weekEnd },
    rotation: plan.rotation,
  });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json().catch(() => ({}));
  const plan = await findPlan(body.week ?? null);
  if (!plan) return NextResponse.json({ error: 'No meal plan' }, { status: 404 });

  const users = await User.find();
  const solver = toSolverHousemates(users as never);

  // Derive a stable week index from how many plans precede this one.
  const weekIndex = await MealPlan.countDocuments({ weekStart: { $lt: plan.weekStart } });

  const assignments = solveRotation(solver, plan.dishes, plan.weekStart, weekIndex);
  plan.rotation = assignments.map((a) => ({
    date: a.date,
    dish: a.dish,
    cook: a.cook as Types.ObjectId,
    cookName: a.cookName,
    reminderSentAt: null,
  })) as never;
  await plan.save();

  return NextResponse.json({ rotation: plan.rotation });
}
