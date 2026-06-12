/**
 * /api/recipes — list & create recipes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Recipe } from '@/models';

// DB-backed: never statically prerender at build time.
export const dynamic = 'force-dynamic';

export async function GET() {
  await connectDB();
  const recipes = await Recipe.find().sort({ name: 1 }).lean();
  return NextResponse.json({ recipes });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const recipe = await Recipe.findOneAndUpdate(
    { name: body.name },
    { $set: body },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return NextResponse.json({ recipe }, { status: 201 });
}
