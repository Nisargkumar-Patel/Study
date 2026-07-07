/**
 * POST /api/auth/login   { name, passcode, phone? }
 *
 * Validates the shared household passcode and issues a 90-day session cookie.
 * If the name doesn't match an existing housemate, a new member is created
 * (next free rotation slot) — this is how a fresh household onboards: each
 * person just signs in with their name and the passcode from whoever set up
 * the server. No fixed member count.
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models';
import { createToken, sessionCookie, SESSION_TTL_MS } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const passcode = String(body.passcode || '');

  if (!name || !passcode) {
    return NextResponse.json({ error: 'Name and passcode are required' }, { status: 400 });
  }

  const expected = process.env.HOUSEHOLD_PASSCODE;
  if (!expected) {
    return NextResponse.json(
      { error: 'Server not configured: set HOUSEHOLD_PASSCODE in the environment.' },
      { status: 500 }
    );
  }
  if (passcode !== expected) {
    return NextResponse.json({ error: 'Wrong passcode' }, { status: 401 });
  }

  await connectDB();

  let user = await User.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') });
  if (!user) {
    // New housemate joins: take the next free rotation slot.
    const last = await User.findOne().sort({ rotationSlot: -1 }).lean();
    const phone = String(body.phone || '').trim();
    user = await User.create({
      name,
      // Placeholder E.164 number until they set a real one in the Household
      // tab; notifyBySms stays off until a real phone is saved.
      phone: /^\+[1-9]\d{6,14}$/.test(phone) ? phone : '+10000000000',
      notifyBySms: /^\+[1-9]\d{6,14}$/.test(phone),
      rotationSlot: (last?.rotationSlot ?? -1) + 1,
      active: true,
    });
  }

  const token = await createToken({
    uid: String(user._id),
    name: user.name,
    exp: Date.now() + SESSION_TTL_MS,
  });

  const res = NextResponse.json({
    ok: true,
    user: { id: String(user._id), name: user.name },
  });
  res.headers.set('Set-Cookie', sessionCookie(token));
  return res;
}
