/**
 * rotation.ts — 7-Housemate Cooking Duty Rotation Solver.
 *
 * Given the active housemates (sorted by their stable `rotationSlot` 0..6) and a
 * week's worth of dish/day pairs, assign a cook to each day so that:
 *   - duty rotates fairly day-by-day,
 *   - the starting cook advances each week (driven by a week index) so the same
 *     person isn't always on Monday,
 *   - inactive housemates are skipped without breaking the cycle.
 *
 * The algorithm is deterministic: the same inputs always yield the same matrix,
 * which makes it safe to recompute idempotently on the server.
 */
import type { UserDoc } from '@/models/User';
import { Types } from 'mongoose';

export interface RotationAssignment {
  date: Date;
  dish: string;
  cook: Types.ObjectId;
  cookName: string;
}

export interface SolverHousemate {
  _id: Types.ObjectId;
  name: string;
  rotationSlot: number;
  active: boolean;
}

/**
 * Solve the day-wise rotation.
 *
 * @param housemates  all 7 housemates (active flag respected)
 * @param dishes      ordered dish names for the week
 * @param weekStart   first cooking date of the week
 * @param weekIndex   monotonically increasing week number; advances the offset
 *                    so the rotation shifts week-over-week
 */
export function solveRotation(
  housemates: SolverHousemate[],
  dishes: string[],
  weekStart: Date,
  weekIndex: number
): RotationAssignment[] {
  const pool = housemates
    .filter((h) => h.active)
    .sort((a, b) => a.rotationSlot - b.rotationSlot);

  if (pool.length === 0) {
    throw new Error('No active housemates available for rotation.');
  }

  const assignments: RotationAssignment[] = [];

  dishes.forEach((dish, dayOffset) => {
    // Advance by the day within the week PLUS the week index so the cycle
    // precesses each week and nobody is permanently stuck on day 1.
    const cookIdx = (weekIndex + dayOffset) % pool.length;
    const cook = pool[cookIdx];

    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayOffset);

    assignments.push({
      date,
      dish,
      cook: cook._id,
      cookName: cook.name,
    });
  });

  return assignments;
}

/** Convenience: turn a UserDoc[] (with _id) into solver housemates. */
export function toSolverHousemates(
  users: Array<UserDoc & { _id: Types.ObjectId }>
): SolverHousemate[] {
  return users.map((u) => ({
    _id: u._id,
    name: u.name,
    rotationSlot: u.rotationSlot,
    active: u.active ?? true,
  }));
}
