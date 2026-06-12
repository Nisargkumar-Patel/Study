/**
 * /api/staples — list, upsert, and update high-capacity household staples.
 *
 * Each staple carries a target baseline sized for 7 people; the grocery engine
 * derives `Staple Delta = targetAmount - currentAmount` automatically.
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Staple } from '@/models';

// DB-backed: never statically prerender at build time.
export const dynamic = 'force-dynamic';

export async function GET() {
  await connectDB();
  const staples = await Staple.find().sort({ name: 1 }).lean();
  return NextResponse.json({ staples });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const staple = await Staple.findOneAndUpdate(
    { name: body.name },
    { $set: body },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return NextResponse.json({ staple }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const staple = await Staple.findOneAndUpdate(
    { name: body.name },
    { $set: { currentAmount: body.currentAmount, lastUpdatedBy: body.lastUpdatedBy } },
    { new: true }
  ).lean();
  return NextResponse.json({ staple });
}
