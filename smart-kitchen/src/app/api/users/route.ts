/**
 * /api/users — household member management.
 *
 * GET            list members (rotation order)
 * POST   {name, phone?}         add a member (next free rotation slot)
 * PATCH  {id, active?, phone?, notifyBySms?}   update a member
 * DELETE ?id=    remove a member (their rotation slot is retired; the solver
 *                simply skips gaps)
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models';

export const dynamic = 'force-dynamic';

const E164 = /^\+[1-9]\d{6,14}$/;

export async function GET() {
  await connectDB();
  const users = await User.find().sort({ rotationSlot: 1 }).lean();
  return NextResponse.json({
    users: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      phone: u.phone,
      rotationSlot: u.rotationSlot,
      active: u.active,
      notifyBySms: u.notifyBySms,
    })),
  });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const exists = await User.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  if (exists) return NextResponse.json({ error: 'Member already exists' }, { status: 409 });

  const phone = String(body.phone || '').trim();
  const last = await User.findOne().sort({ rotationSlot: -1 }).lean();
  const user = await User.create({
    name,
    phone: E164.test(phone) ? phone : '+10000000000',
    notifyBySms: E164.test(phone),
    rotationSlot: (last?.rotationSlot ?? -1) + 1,
    active: true,
  });
  return NextResponse.json({ user: { id: String(user._id), name: user.name } }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await connectDB();
  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.active === 'boolean') update.active = body.active;
  if (typeof body.notifyBySms === 'boolean') update.notifyBySms = body.notifyBySms;
  if (typeof body.phone === 'string') {
    const phone = body.phone.trim();
    if (!E164.test(phone)) {
      return NextResponse.json(
        { error: 'Phone must be E.164 format, e.g. +14155550123' },
        { status: 400 }
      );
    }
    update.phone = phone;
    update.notifyBySms = true;
  }

  const user = await User.findByIdAndUpdate(body.id, { $set: update }, { new: true }).lean();
  if (!user) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await connectDB();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await User.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
