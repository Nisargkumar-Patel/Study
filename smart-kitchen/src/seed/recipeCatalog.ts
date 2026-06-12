/**
 * recipeCatalog.ts — Authored ingredient bills of materials.
 *
 * Quantities here are authored for `baseServings` people and ALREADY normalized
 * to canonical base units (g / ml / pcs). The scaler multiplies them by
 * (HOUSEHOLD_SIZE / baseServings) at grocery-generation time.
 *
 * Not every one of the ~120 unique dishes in the schedule has a hand-written
 * recipe; the seeder auto-creates a lightweight placeholder (baseServings 4,
 * empty ingredients) for any dish missing here, so the meal plans always
 * reference a real Recipe document. Fill these in over time from the app.
 */

export interface SeedIngredient {
  name: string;
  baseAmount: number;
  baseUnit: 'g' | 'ml' | 'pcs';
  pantryCategory:
    | 'Produce'
    | 'Dairy'
    | 'Grains'
    | 'Legumes'
    | 'Spices'
    | 'Condiments'
    | 'Frozen'
    | 'Other';
}

export interface SeedRecipe {
  name: string;
  baseServings: number;
  ingredients: SeedIngredient[];
}

export const RECIPE_CATALOG: SeedRecipe[] = [
  {
    name: 'Dal fry',
    baseServings: 4,
    ingredients: [
      { name: 'Toor dal', baseAmount: 300, baseUnit: 'g', pantryCategory: 'Legumes' },
      { name: 'Onion', baseAmount: 150, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Tomato', baseAmount: 150, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Ghee', baseAmount: 30, baseUnit: 'ml', pantryCategory: 'Dairy' },
      { name: 'Turmeric', baseAmount: 5, baseUnit: 'g', pantryCategory: 'Spices' },
      { name: 'Cumin seeds', baseAmount: 5, baseUnit: 'g', pantryCategory: 'Spices' },
    ],
  },
  {
    name: 'Paneer',
    baseServings: 4,
    ingredients: [
      { name: 'Paneer', baseAmount: 400, baseUnit: 'g', pantryCategory: 'Dairy' },
      { name: 'Onion', baseAmount: 200, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Tomato', baseAmount: 250, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Cream', baseAmount: 100, baseUnit: 'ml', pantryCategory: 'Dairy' },
      { name: 'Garam masala', baseAmount: 8, baseUnit: 'g', pantryCategory: 'Spices' },
      { name: 'Ginger garlic paste', baseAmount: 20, baseUnit: 'g', pantryCategory: 'Condiments' },
    ],
  },
  {
    name: 'Chole',
    baseServings: 4,
    ingredients: [
      { name: 'Chickpeas', baseAmount: 350, baseUnit: 'g', pantryCategory: 'Legumes' },
      { name: 'Onion', baseAmount: 200, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Tomato', baseAmount: 200, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Chole masala', baseAmount: 15, baseUnit: 'g', pantryCategory: 'Spices' },
      { name: 'Oil', baseAmount: 40, baseUnit: 'ml', pantryCategory: 'Condiments' },
    ],
  },
  {
    name: 'Khichdi',
    baseServings: 4,
    ingredients: [
      { name: 'Rice', baseAmount: 300, baseUnit: 'g', pantryCategory: 'Grains' },
      { name: 'Moong dal', baseAmount: 200, baseUnit: 'g', pantryCategory: 'Legumes' },
      { name: 'Ghee', baseAmount: 30, baseUnit: 'ml', pantryCategory: 'Dairy' },
      { name: 'Turmeric', baseAmount: 4, baseUnit: 'g', pantryCategory: 'Spices' },
      { name: 'Cumin seeds', baseAmount: 5, baseUnit: 'g', pantryCategory: 'Spices' },
    ],
  },
  {
    name: 'Pav bhaji',
    baseServings: 4,
    ingredients: [
      { name: 'Potato', baseAmount: 400, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Mixed vegetables', baseAmount: 400, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Pav buns', baseAmount: 8, baseUnit: 'pcs', pantryCategory: 'Grains' },
      { name: 'Butter', baseAmount: 100, baseUnit: 'g', pantryCategory: 'Dairy' },
      { name: 'Pav bhaji masala', baseAmount: 20, baseUnit: 'g', pantryCategory: 'Spices' },
    ],
  },
  {
    name: 'Mung',
    baseServings: 4,
    ingredients: [
      { name: 'Whole moong', baseAmount: 350, baseUnit: 'g', pantryCategory: 'Legumes' },
      { name: 'Onion', baseAmount: 100, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Oil', baseAmount: 30, baseUnit: 'ml', pantryCategory: 'Condiments' },
      { name: 'Turmeric', baseAmount: 4, baseUnit: 'g', pantryCategory: 'Spices' },
    ],
  },
  {
    name: 'Cabbage bataka',
    baseServings: 4,
    ingredients: [
      { name: 'Cabbage', baseAmount: 400, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Potato', baseAmount: 300, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Oil', baseAmount: 30, baseUnit: 'ml', pantryCategory: 'Condiments' },
      { name: 'Mustard seeds', baseAmount: 4, baseUnit: 'g', pantryCategory: 'Spices' },
    ],
  },
  {
    name: 'Palak paneer',
    baseServings: 4,
    ingredients: [
      { name: 'Spinach', baseAmount: 500, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Paneer', baseAmount: 300, baseUnit: 'g', pantryCategory: 'Dairy' },
      { name: 'Onion', baseAmount: 150, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Cream', baseAmount: 80, baseUnit: 'ml', pantryCategory: 'Dairy' },
      { name: 'Garam masala', baseAmount: 8, baseUnit: 'g', pantryCategory: 'Spices' },
    ],
  },
  {
    name: 'Aloo mattar',
    baseServings: 4,
    ingredients: [
      { name: 'Potato', baseAmount: 400, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Green peas', baseAmount: 250, baseUnit: 'g', pantryCategory: 'Frozen' },
      { name: 'Tomato', baseAmount: 200, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Oil', baseAmount: 30, baseUnit: 'ml', pantryCategory: 'Condiments' },
      { name: 'Coriander powder', baseAmount: 8, baseUnit: 'g', pantryCategory: 'Spices' },
    ],
  },
  {
    name: 'Thepla',
    baseServings: 4,
    ingredients: [
      { name: 'Wheat flour', baseAmount: 400, baseUnit: 'g', pantryCategory: 'Grains' },
      { name: 'Fenugreek leaves', baseAmount: 150, baseUnit: 'g', pantryCategory: 'Produce' },
      { name: 'Yogurt', baseAmount: 100, baseUnit: 'ml', pantryCategory: 'Dairy' },
      { name: 'Oil', baseAmount: 50, baseUnit: 'ml', pantryCategory: 'Condiments' },
      { name: 'Turmeric', baseAmount: 4, baseUnit: 'g', pantryCategory: 'Spices' },
    ],
  },
];
