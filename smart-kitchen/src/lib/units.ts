/**
 * units.ts — Strict base-metric standardization.
 *
 * To prevent mathematical errors when subtracting pantry inventory from scaled
 * recipe requirements, EVERY quantity in the system is normalized to one of
 * three canonical base units before any arithmetic is performed:
 *
 *   - MASS    -> grams        (g)
 *   - VOLUME  -> milliliters  (ml)
 *   - COUNT   -> pieces       (pcs)
 *
 * A recipe may author an ingredient as "1.5 kg" or "2 tbsp"; we convert it to
 * the base unit on the way in, do all math in base units, and convert back to a
 * human-friendly display unit only at the very end (for the grocery list UI).
 */

export type BaseUnit = 'g' | 'ml' | 'pcs';
export type Dimension = 'MASS' | 'VOLUME' | 'COUNT';

export const DIMENSION_OF: Record<BaseUnit, Dimension> = {
  g: 'MASS',
  ml: 'VOLUME',
  pcs: 'COUNT',
};

/** Multiplier to convert `1 <unit>` into its canonical base unit. */
const TO_BASE: Record<string, { base: BaseUnit; factor: number }> = {
  // mass
  mg: { base: 'g', factor: 0.001 },
  g: { base: 'g', factor: 1 },
  gram: { base: 'g', factor: 1 },
  grams: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  // volume
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  litre: { base: 'ml', factor: 1000 },
  liter: { base: 'ml', factor: 1000 },
  tsp: { base: 'ml', factor: 5 },
  tbsp: { base: 'ml', factor: 15 },
  cup: { base: 'ml', factor: 240 },
  // count
  pcs: { base: 'pcs', factor: 1 },
  piece: { base: 'pcs', factor: 1 },
  pieces: { base: 'pcs', factor: 1 },
  unit: { base: 'pcs', factor: 1 },
  dozen: { base: 'pcs', factor: 12 },
};

export interface BaseQuantity {
  amount: number; // always in the base unit
  unit: BaseUnit;
}

/**
 * Normalize any authored quantity into the canonical base unit.
 * @throws if the unit is unknown.
 */
export function toBase(amount: number, unit: string): BaseQuantity {
  const key = unit.trim().toLowerCase();
  const conv = TO_BASE[key];
  if (!conv) {
    throw new Error(`Unknown unit "${unit}". Add it to units.ts TO_BASE map.`);
  }
  return { amount: amount * conv.factor, unit: conv.base };
}

/**
 * Convert a base quantity into a friendly display string, picking a sensible
 * larger unit when the number gets big (e.g. 1500 g -> "1.5 kg").
 */
export function formatBase(q: BaseQuantity): string {
  const round = (n: number) => Math.round(n * 100) / 100;
  switch (q.unit) {
    case 'g':
      return q.amount >= 1000 ? `${round(q.amount / 1000)} kg` : `${round(q.amount)} g`;
    case 'ml':
      return q.amount >= 1000 ? `${round(q.amount / 1000)} L` : `${round(q.amount)} ml`;
    case 'pcs':
      return `${round(q.amount)} pcs`;
  }
}

/** Add two base quantities of the SAME dimension. */
export function addBase(a: BaseQuantity, b: BaseQuantity): BaseQuantity {
  if (a.unit !== b.unit) {
    throw new Error(`Cannot add incompatible units: ${a.unit} + ${b.unit}`);
  }
  return { amount: a.amount + b.amount, unit: a.unit };
}

/** Subtract b from a, clamped at zero (you can't need a negative amount). */
export function subtractBase(a: BaseQuantity, b: BaseQuantity): BaseQuantity {
  if (a.unit !== b.unit) {
    throw new Error(`Cannot subtract incompatible units: ${a.unit} - ${b.unit}`);
  }
  return { amount: Math.max(0, a.amount - b.amount), unit: a.unit };
}
