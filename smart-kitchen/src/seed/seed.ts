/**
 * seed.ts — Idempotent database seeder.
 *
 *   npm run seed
 *
 * Populates:
 *   - 7 sample housemates (Users) — replaceable via the House tab / login
 *   - Recipes (catalog + auto-placeholders for every dish in the schedule)
 *   - MealPlans for every week, with a solved cooking-duty rotation
 *   - A starter set of Staples sized for 7 people
 *
 * Safe to re-run: upserts by natural key (name / weekStart / rotationSlot).
 */
import 'dotenv/config';
import { connectDB } from '@/lib/db';
import { User, Recipe, MealPlan, Staple } from '@/models';
import { DINNER_SCHEDULE } from './dinnerSchedule';
import { RECIPE_CATALOG, DISH_ALIASES } from './recipeCatalog';
import { solveRotation, toSolverHousemates } from '@/server/rotation';
import mongoose from 'mongoose';

const HOUSEMATES = [
  { name: 'Aarav', phone: '+15550000001', rotationSlot: 0 },
  { name: 'Bhavya', phone: '+15550000002', rotationSlot: 1 },
  { name: 'Chirag', phone: '+15550000003', rotationSlot: 2 },
  { name: 'Dhruv', phone: '+15550000004', rotationSlot: 3 },
  { name: 'Esha', phone: '+15550000005', rotationSlot: 4 },
  { name: 'Faisal', phone: '+15550000006', rotationSlot: 5 },
  { name: 'Gauri', phone: '+15550000007', rotationSlot: 6 },
];

const STAPLES = [
  { name: 'Milk', targetAmount: 8000, baseUnit: 'ml', currentAmount: 0 },
  { name: 'Bread', targetAmount: 6, baseUnit: 'pcs', currentAmount: 0 },
  { name: 'Eggs', targetAmount: 24, baseUnit: 'pcs', currentAmount: 0 },
  { name: 'Paper Towels', targetAmount: 8, baseUnit: 'pcs', currentAmount: 0 },
  { name: 'Rice', targetAmount: 10000, baseUnit: 'g', currentAmount: 2000 },
  { name: 'Cooking Oil', targetAmount: 5000, baseUnit: 'ml', currentAmount: 1000 },
  { name: 'Wheat flour', targetAmount: 10000, baseUnit: 'g', currentAmount: 3000 },
] as const;

async function seed() {
  await connectDB();
  console.log('Connected. Seeding…');

  // ---- Users -------------------------------------------------------------
  for (const h of HOUSEMATES) {
    await User.updateOne(
      { rotationSlot: h.rotationSlot },
      { $set: h },
      { upsert: true }
    );
  }
  const users = await User.find().lean();
  console.log(`Users: ${users.length}`);

  // ---- Recipes -----------------------------------------------------------
  // Resolve every unique schedule dish to its canonical ingredients (direct
  // name match, else alias) and create a Recipe under the EXACT schedule
  // spelling so the grocery engine's exact-name lookups keep working. Dishes
  // with no canonical recipe fall back to a lightweight placeholder.
  const catalogByName = new Map(RECIPE_CATALOG.map((r) => [r.name.toLowerCase(), r]));

  const resolveCanonical = (dish: string) => {
    const key = dish.trim().toLowerCase();
    if (catalogByName.has(key)) return catalogByName.get(key)!;
    const alias = DISH_ALIASES[key];
    if (alias && catalogByName.has(alias.toLowerCase())) {
      return catalogByName.get(alias.toLowerCase())!;
    }
    return null;
  };

  const allDishes = new Set<string>();
  for (const w of DINNER_SCHEDULE) w.dishes.forEach((d) => allDishes.add(d));

  let covered = 0;
  let placeholders = 0;
  for (const dish of allDishes) {
    const canonical = resolveCanonical(dish);
    if (canonical) {
      covered += 1;
      await Recipe.updateOne(
        { name: dish },
        {
          $set: {
            name: dish,
            baseServings: canonical.baseServings,
            ingredients: canonical.ingredients,
            tags: [],
          },
        },
        { upsert: true }
      );
    } else {
      placeholders += 1;
      await Recipe.updateOne(
        { name: dish },
        { $setOnInsert: { name: dish, baseServings: 4, ingredients: [], tags: ['placeholder'] } },
        { upsert: true }
      );
    }
  }
  console.log(
    `Recipes: ${await Recipe.countDocuments()} (${covered} with ingredients, ${placeholders} placeholders)`
  );

  // ---- Staples -----------------------------------------------------------
  for (const s of STAPLES) {
    await Staple.updateOne({ name: s.name }, { $set: s }, { upsert: true });
  }
  console.log(`Staples: ${await Staple.countDocuments()}`);

  // ---- Meal plans + rotation ---------------------------------------------
  const solverUsers = toSolverHousemates(
    users.map((u) => ({ ...u, _id: u._id as mongoose.Types.ObjectId })) as never
  );
  let weekIndex = 0;
  for (const w of DINNER_SCHEDULE) {
    const weekStart = new Date(w.weekStart);
    const weekEnd = new Date(w.weekEnd);
    const rotation = solveRotation(solverUsers, w.dishes, weekStart, weekIndex);

    await MealPlan.updateOne(
      { weekStart },
      {
        $set: {
          weekStart,
          weekEnd,
          dishes: w.dishes,
          rotation: rotation.map((r) => ({
            date: r.date,
            dish: r.dish,
            cook: r.cook,
            cookName: r.cookName,
            reminderSentAt: null,
          })),
          status: 'draft',
        },
      },
      { upsert: true }
    );
    weekIndex += 1;
  }
  console.log(`MealPlans: ${await MealPlan.countDocuments()}`);

  console.log('Seed complete.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
