/**
 * /api/inventory — list, upsert, and toggle pantry inventory.
 *
 * PATCH supports the boolean Spices toggle: { name, inStock } flips an item's
 * in-stock flag without touching measured amounts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Inventory } from '@/models';

// DB-backed: never statically prerender at build time.
export const dynamic = 'force-dynamic';

export async function GET() {
  await connectDB();
  const inventory = await Inventory.find().sort({ pantryCategory: 1, name: 1 }).lean();
  return NextResponse.json({ inventory });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const item = await Inventory.findOneAndUpdate(
    { name: body.name },
    { $set: body },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (typeof body.inStock === 'boolean') update.inStock = body.inStock;
  if (typeof body.baseAmount === 'number') update.baseAmount = body.baseAmount;
  if (body.lastUpdatedBy) update.lastUpdatedBy = body.lastUpdatedBy;

  const item = await Inventory.findOneAndUpdate(
    { name: body.name },
    { $set: update },
    { new: true }
  ).lean();
  return NextResponse.json({ item });
}
