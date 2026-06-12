/**
 * /api/mealplans — list weekly meal plans (most recent first).
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { MealPlan } from '@/models';

// DB-backed: never statically prerender at build time.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await connectDB();
  const limit = Number(req.nextUrl.searchParams.get('limit') || 12);
  const mealPlans = await MealPlan.find().sort({ weekStart: -1 }).limit(limit).lean();
  return NextResponse.json({ mealPlans });
}
