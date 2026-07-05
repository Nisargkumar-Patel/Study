/**
 * POST /api/rotation/notify   { week?, date? }
 *
 * Dispatch AWS SNS SMS reminders to the assigned cook(s). With a `date` we
 * notify only that day's cook; otherwise we notify every cook in the week whose
 * reminder hasn't been sent yet. Marks `reminderSentAt` so reminders aren't
 * duplicated (safe to call from a daily cron / scheduled trigger).
 */
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User, MealPlan } from '@/models';
import { sendCookReminders, type CookReminder } from '@/server/notifications';

// DB-backed: never statically prerender at build time.
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json().catch(() => ({}));

  const plan = body.week
    ? await MealPlan.findOne({ weekStart: new Date(body.week) })
    : await MealPlan.findOne({
        weekStart: { $lte: new Date() },
        weekEnd: { $gte: new Date() },
      });

  if (!plan) return NextResponse.json({ error: 'No meal plan' }, { status: 404 });

  // Build a phone lookup for the assigned cooks.
  const users = await User.find().lean();
  const phoneById = new Map(users.map((u) => [String(u._id), u]));

  const targetDate = body.date ? new Date(body.date).toDateString() : null;

  const reminders: CookReminder[] = [];
  const indicesToMark: number[] = [];

  plan.rotation.forEach((entry, i) => {
    if (targetDate && new Date(entry.date).toDateString() !== targetDate) return;
    if (!targetDate && entry.reminderSentAt) return; // already notified

    const user = phoneById.get(String(entry.cook));
    if (user?.notifyBySms && user.phone) {
      reminders.push({
        phone: user.phone,
        cookName: entry.cookName,
        dish: entry.dish,
        date: new Date(entry.date),
      });
      indicesToMark.push(i);
    }
  });

  if (reminders.length === 0) {
    return NextResponse.json({ sent: 0, failures: [], message: 'No reminders due' });
  }

  const result = await sendCookReminders(reminders);

  // Mark reminderSentAt per successful send, so a partial failure doesn't
  // cause the already-notified cooks to be texted again on retry.
  const failedCooks = new Set(result.failures.map((f) => f.cookName));
  let marked = 0;
  indicesToMark.forEach((i) => {
    if (!failedCooks.has(plan.rotation[i].cookName)) {
      plan.rotation[i].reminderSentAt = new Date();
      marked += 1;
    }
  });
  if (marked > 0) await plan.save();

  return NextResponse.json(result);
}
