/**
 * recipeCatalog.ts — Authored ingredient bills of materials.
 *
 * Quantities are authored for `baseServings` people and ALREADY normalized to
 * canonical base units (g / ml / pcs). The scaler multiplies them by
 * (HOUSEHOLD_SIZE / baseServings) at grocery-generation time.
 *
 * The household dinner schedule uses many spelling variants for the same dish
 * (e.g. "Dal fry" / "Daal fry", "Biriyani" / "Biryani", "Pani puri" /
 * "Panipuri"). To avoid authoring the same recipe many times we keep ONE
 * canonical recipe per real dish in RECIPE_CATALOG and map every spelling
 * variant to a canonical name in DISH_ALIASES. The seeder resolves each
 * schedule dish (direct name match, else alias) to its canonical ingredients
 * and creates a Recipe document under the exact schedule spelling, so the
 * grocery engine's exact-name lookups keep working.
 *
 * A handful of one-off snacks/specials with no meaningful scalable ingredient
 * list still fall through to lightweight placeholders in the seeder.
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

// ---- Compact typed ingredient builders ------------------------------------
const prod = (name: string, g: number): SeedIngredient => ({ name, baseAmount: g, baseUnit: 'g', pantryCategory: 'Produce' });
const dy = (name: string, amt: number, unit: 'g' | 'ml' = 'g'): SeedIngredient => ({ name, baseAmount: amt, baseUnit: unit, pantryCategory: 'Dairy' });
const gr = (name: string, g: number): SeedIngredient => ({ name, baseAmount: g, baseUnit: 'g', pantryCategory: 'Grains' });
const lg = (name: string, g: number): SeedIngredient => ({ name, baseAmount: g, baseUnit: 'g', pantryCategory: 'Legumes' });
const fz = (name: string, g: number): SeedIngredient => ({ name, baseAmount: g, baseUnit: 'g', pantryCategory: 'Frozen' });
const cn = (name: string, amt: number, unit: 'g' | 'ml' = 'ml'): SeedIngredient => ({ name, baseAmount: amt, baseUnit: unit, pantryCategory: 'Condiments' });
const sp = (name: string): SeedIngredient => ({ name, baseAmount: 8, baseUnit: 'g', pantryCategory: 'Spices' });
const pc = (name: string, n: number, cat: SeedIngredient['pantryCategory'] = 'Grains'): SeedIngredient => ({ name, baseAmount: n, baseUnit: 'pcs', pantryCategory: cat });

// Common building blocks reused across many curries.
const oil = cn('Oil', 30);
const onion = (g = 150) => prod('Onion', g);
const tomato = (g = 150) => prod('Tomato', g);
const potato = (g = 300) => prod('Potato', g);
const ggPaste = cn('Ginger garlic paste', 20, 'g');

export const RECIPE_CATALOG: SeedRecipe[] = [
  // ---- Dals & khichdis ---------------------------------------------------
  { name: 'Dal fry', baseServings: 4, ingredients: [lg('Toor dal', 300), onion(), tomato(), dy('Ghee', 30, 'ml'), sp('Turmeric'), sp('Cumin seeds')] },
  { name: 'Dal Tadka', baseServings: 4, ingredients: [lg('Toor dal', 300), onion(120), tomato(120), dy('Ghee', 30, 'ml'), sp('Red chili powder'), sp('Cumin seeds')] },
  { name: 'Dal bhat', baseServings: 4, ingredients: [lg('Toor dal', 250), gr('Rice', 400), tomato(120), dy('Ghee', 20, 'ml'), sp('Turmeric'), sp('Mustard seeds')] },
  { name: 'Dal palak', baseServings: 4, ingredients: [lg('Toor dal', 250), prod('Spinach', 350), onion(120), tomato(120), oil, sp('Cumin seeds')] },
  { name: 'Daal makhni', baseServings: 4, ingredients: [lg('Whole urad dal', 250), lg('Rajma', 80), dy('Butter', 80), dy('Cream', 100, 'ml'), ggPaste, sp('Garam masala')] },
  { name: 'Daal dhokli', baseServings: 4, ingredients: [lg('Toor dal', 250), gr('Wheat flour', 200), tomato(120), oil, sp('Turmeric'), sp('Red chili powder')] },
  { name: 'Daal bati', baseServings: 4, ingredients: [gr('Wheat flour', 400), lg('Toor dal', 250), dy('Ghee', 80, 'ml'), onion(120), sp('Garam masala'), sp('Turmeric')] },
  { name: 'Mung daal', baseServings: 4, ingredients: [lg('Moong dal', 350), tomato(100), dy('Ghee', 25, 'ml'), sp('Turmeric'), sp('Cumin seeds')] },
  { name: 'Khichdi', baseServings: 4, ingredients: [gr('Rice', 300), lg('Moong dal', 200), dy('Ghee', 30, 'ml'), sp('Turmeric'), sp('Cumin seeds')] },
  { name: 'Masala khichdi', baseServings: 4, ingredients: [gr('Rice', 300), lg('Moong dal', 200), fz('Mixed vegetables', 200), dy('Ghee', 30, 'ml'), sp('Garam masala'), sp('Turmeric')] },
  { name: 'Kadhi khichdi', baseServings: 4, ingredients: [gr('Rice', 300), lg('Moong dal', 150), dy('Yogurt', 400, 'ml'), lg('Gram flour', 80), sp('Turmeric'), sp('Mustard seeds')] },

  // ---- Chana / rajma -----------------------------------------------------
  { name: 'Chole', baseServings: 4, ingredients: [lg('Chickpeas', 350), onion(200), tomato(200), oil, sp('Chole masala')] },
  { name: 'Desi chana', baseServings: 4, ingredients: [lg('Kala chana', 350), onion(180), tomato(180), oil, sp('Coriander powder'), sp('Garam masala')] },
  { name: 'Chana Chaat', baseServings: 4, ingredients: [lg('Kala chana', 300), onion(120), tomato(120), prod('Coriander leaves', 30), sp('Chaat masala')] },
  { name: 'Rajma Chawal', baseServings: 4, ingredients: [lg('Rajma', 300), gr('Rice', 400), onion(180), tomato(200), ggPaste, sp('Garam masala')] },

  // ---- Paneer dishes -----------------------------------------------------
  { name: 'Paneer', baseServings: 4, ingredients: [dy('Paneer', 400), onion(200), tomato(250), dy('Cream', 100, 'ml'), ggPaste, sp('Garam masala')] },
  { name: 'Palak paneer', baseServings: 4, ingredients: [prod('Spinach', 500), dy('Paneer', 300), onion(150), dy('Cream', 80, 'ml'), sp('Garam masala')] },
  { name: 'Mataar paneer', baseServings: 4, ingredients: [dy('Paneer', 300), fz('Green peas', 250), tomato(250), onion(150), oil, sp('Garam masala')] },
  { name: 'Shahi paneer', baseServings: 4, ingredients: [dy('Paneer', 400), onion(180), dy('Cream', 120, 'ml'), prod('Cashews', 60), ggPaste, sp('Garam masala')] },
  { name: 'Paneer butter masala', baseServings: 4, ingredients: [dy('Paneer', 400), dy('Butter', 80), tomato(300), dy('Cream', 100, 'ml'), ggPaste, sp('Garam masala')] },
  { name: 'Paneer bhurji', baseServings: 4, ingredients: [dy('Paneer', 400), onion(150), tomato(150), prod('Capsicum', 120), oil, sp('Turmeric')] },
  { name: 'Paneer Tikka', baseServings: 4, ingredients: [dy('Paneer', 400), dy('Yogurt', 150, 'ml'), prod('Capsicum', 150), onion(150), ggPaste, sp('Tandoori masala')] },
  { name: 'Kaju paneer', baseServings: 4, ingredients: [dy('Paneer', 350), prod('Cashews', 100), onion(150), dy('Cream', 100, 'ml'), ggPaste, sp('Garam masala')] },

  // ---- Aloo / bataka sabjis ---------------------------------------------
  { name: 'Aloo mattar', baseServings: 4, ingredients: [potato(400), fz('Green peas', 250), tomato(200), oil, sp('Coriander powder')] },
  { name: 'Aloo methi', baseServings: 4, ingredients: [potato(400), prod('Fenugreek leaves', 200), oil, sp('Turmeric'), sp('Cumin seeds')] },
  { name: 'Cabbage bataka', baseServings: 4, ingredients: [prod('Cabbage', 400), potato(300), oil, sp('Mustard seeds'), sp('Turmeric')] },
  { name: 'Flower bataka', baseServings: 4, ingredients: [prod('Cauliflower', 450), potato(300), oil, sp('Turmeric'), sp('Garam masala')] },
  { name: 'Dungli bataka', baseServings: 4, ingredients: [onion(350), potato(350), oil, sp('Turmeric'), sp('Red chili powder')] },
  { name: 'Suki bhaji', baseServings: 4, ingredients: [potato(500), oil, prod('Coriander leaves', 25), sp('Turmeric'), sp('Mustard seeds')] },
  { name: 'Lasaniya bataka', baseServings: 4, ingredients: [potato(500), prod('Garlic', 60), oil, sp('Red chili powder'), sp('Coriander powder')] },
  { name: 'Rasavala bataka', baseServings: 4, ingredients: [potato(450), tomato(200), oil, lg('Gram flour', 30), sp('Turmeric'), sp('Red chili powder')] },
  { name: 'Bataka vatana', baseServings: 4, ingredients: [potato(350), fz('Green peas', 250), oil, sp('Turmeric'), sp('Cumin seeds')] },
  { name: 'Methi bataka', baseServings: 4, ingredients: [potato(400), prod('Fenugreek leaves', 200), oil, sp('Turmeric'), sp('Red chili powder')] },
  { name: 'Daam aloo', baseServings: 4, ingredients: [potato(500), tomato(200), dy('Yogurt', 120, 'ml'), oil, sp('Garam masala'), sp('Kashmiri chili')] },
  { name: 'Aloo changezi', baseServings: 4, ingredients: [potato(450), onion(180), tomato(200), prod('Cashews', 50), oil, sp('Garam masala')] },

  // ---- Other vegetable sabjis -------------------------------------------
  { name: 'Mix veg', baseServings: 4, ingredients: [fz('Mixed vegetables', 500), onion(120), tomato(150), oil, sp('Garam masala')] },
  { name: 'Corn capsicum', baseServings: 4, ingredients: [fz('Sweet corn', 300), prod('Capsicum', 250), onion(120), oil, sp('Garam masala')] },
  { name: 'Bhinda', baseServings: 4, ingredients: [prod('Okra', 500), oil, sp('Turmeric'), sp('Coriander powder')] },
  { name: 'Bhinda bataka', baseServings: 4, ingredients: [prod('Okra', 350), potato(250), oil, sp('Turmeric'), sp('Red chili powder')] },
  { name: 'Gavar bataka', baseServings: 4, ingredients: [prod('Cluster beans', 400), potato(250), oil, sp('Turmeric'), sp('Mustard seeds')] },
  { name: 'Tinda bataka', baseServings: 4, ingredients: [prod('Tinda', 400), potato(250), oil, sp('Turmeric'), sp('Cumin seeds')] },
  { name: 'Tindoda bataka', baseServings: 4, ingredients: [prod('Ivy gourd', 400), potato(250), oil, sp('Turmeric'), sp('Red chili powder')] },
  { name: 'Methi mattar malai', baseServings: 4, ingredients: [prod('Fenugreek leaves', 200), fz('Green peas', 250), dy('Cream', 150, 'ml'), onion(120), sp('Garam masala')] },
  { name: 'Malai pyaz', baseServings: 4, ingredients: [onion(400), dy('Cream', 150, 'ml'), prod('Cashews', 50), oil, sp('Garam masala')] },
  { name: 'Mushroom Masala', baseServings: 4, ingredients: [prod('Mushroom', 400), onion(150), tomato(180), oil, sp('Garam masala')] },
  { name: 'Veg kolhapuri', baseServings: 4, ingredients: [fz('Mixed vegetables', 450), prod('Coconut', 80), onion(150), oil, sp('Kolhapuri masala')] },
  { name: 'Veg amritsari', baseServings: 4, ingredients: [fz('Mixed vegetables', 450), onion(150), tomato(180), dy('Cream', 80, 'ml'), sp('Garam masala')] },
  { name: 'Veg kheema', baseServings: 4, ingredients: [lg('Soya granules', 250), fz('Green peas', 150), onion(180), tomato(180), oil, sp('Garam masala')] },
  { name: 'Manchuriyan', baseServings: 4, ingredients: [prod('Cabbage', 300), prod('Carrot', 150), gr('Cornflour', 100), cn('Soy sauce', 40), cn('Schezwan sauce', 40)] },
  { name: 'Gobi pakora', baseServings: 4, ingredients: [prod('Cauliflower', 400), lg('Gram flour', 200), cn('Oil', 250), sp('Red chili powder'), sp('Carom seeds')] },
  { name: 'Ringan bhartu', baseServings: 4, ingredients: [prod('Eggplant', 500), onion(150), tomato(150), oil, sp('Turmeric'), sp('Red chili powder')] },
  { name: 'Tuver totha', baseServings: 4, ingredients: [lg('Tuver (pigeon peas)', 350), prod('Coconut', 50), oil, sp('Garam masala'), sp('Turmeric')] },
  { name: 'Mix kathod', baseServings: 4, ingredients: [lg('Mixed sprouts', 350), onion(120), tomato(120), oil, sp('Turmeric'), sp('Garam masala')] },
  { name: 'Mung', baseServings: 4, ingredients: [lg('Whole moong', 350), onion(100), oil, sp('Turmeric'), sp('Mustard seeds')] },
  { name: 'Sev tameta', baseServings: 4, ingredients: [tomato(400), gr('Sev', 120), onion(100), oil, sp('Turmeric'), sp('Red chili powder')] },
  { name: 'Chevda sabji', baseServings: 4, ingredients: [gr('Thick poha', 300), potato(200), oil, prod('Coriander leaves', 25), sp('Turmeric')] },
  { name: 'Pav bhaji', baseServings: 4, ingredients: [potato(400), fz('Mixed vegetables', 400), pc('Pav buns', 8), dy('Butter', 100), sp('Pav bhaji masala')] },

  // ---- Rice dishes -------------------------------------------------------
  { name: 'Biryani', baseServings: 4, ingredients: [gr('Basmati rice', 500), fz('Mixed vegetables', 350), dy('Yogurt', 150, 'ml'), onion(200), sp('Biryani masala')] },
  { name: 'Veg pulao', baseServings: 4, ingredients: [gr('Basmati rice', 450), fz('Mixed vegetables', 300), dy('Ghee', 30, 'ml'), onion(120), sp('Garam masala')] },
  { name: 'Fried rice', baseServings: 4, ingredients: [gr('Rice', 450), fz('Mixed vegetables', 300), cn('Soy sauce', 40), cn('Oil', 40), prod('Spring onion', 60)] },
  { name: 'Sezwan rice', baseServings: 4, ingredients: [gr('Rice', 450), fz('Mixed vegetables', 300), cn('Schezwan sauce', 80), cn('Oil', 40), prod('Capsicum', 120)] },

  // ---- Chaat / street food ----------------------------------------------
  { name: 'Pani puri', baseServings: 4, ingredients: [pc('Puri shells', 80), potato(250), lg('Chickpeas', 150), cn('Tamarind chutney', 200), sp('Chaat masala')] },
  { name: 'Dahi puri', baseServings: 4, ingredients: [pc('Puri shells', 60), potato(250), dy('Yogurt', 400, 'ml'), cn('Tamarind chutney', 150), sp('Chaat masala')] },
  { name: 'Dabeli', baseServings: 4, ingredients: [pc('Pav buns', 8), potato(350), cn('Dabeli masala', 40, 'g'), gr('Sev', 80), prod('Pomegranate', 60)] },
  { name: 'Vada Pav', baseServings: 4, ingredients: [pc('Pav buns', 8), potato(400), lg('Gram flour', 200), cn('Oil', 250), sp('Mustard seeds')] },
  { name: 'Sev usal', baseServings: 4, ingredients: [lg('White peas', 300), gr('Sev', 120), pc('Pav buns', 8), onion(120), sp('Garam masala')] },
  { name: 'Ragda petis', baseServings: 4, ingredients: [lg('White peas', 300), potato(400), gr('Bread crumbs', 80), cn('Tamarind chutney', 150), sp('Chaat masala')] },

  // ---- Farsan / Gujarati specials ---------------------------------------
  { name: 'Thepla', baseServings: 4, ingredients: [gr('Wheat flour', 400), prod('Fenugreek leaves', 150), dy('Yogurt', 100, 'ml'), cn('Oil', 50), sp('Turmeric')] },
  { name: 'Handvo', baseServings: 4, ingredients: [gr('Handvo flour', 350), dy('Yogurt', 200, 'ml'), prod('Bottle gourd', 200), oil, sp('Mustard seeds')] },
  { name: 'Dhokla', baseServings: 4, ingredients: [lg('Gram flour', 350), dy('Yogurt', 200, 'ml'), cn('Eno fruit salt', 15, 'g'), oil, sp('Mustard seeds')] },
  { name: 'Muthiya', baseServings: 4, ingredients: [gr('Wheat flour', 250), lg('Gram flour', 120), prod('Bottle gourd', 200), oil, sp('Turmeric')] },
  { name: 'Sabudana khichdi', baseServings: 4, ingredients: [gr('Sabudana (tapioca)', 350), potato(200), prod('Peanuts', 120), dy('Ghee', 30, 'ml'), sp('Cumin seeds')] },
  { name: 'Surti locho', baseServings: 4, ingredients: [lg('Gram flour', 300), lg('Toor dal', 80), dy('Butter', 60), cn('Eno fruit salt', 15, 'g'), sp('Turmeric')] },
  { name: 'Kaju gathiya', baseServings: 4, ingredients: [lg('Gram flour', 400), cn('Oil', 300), sp('Carom seeds'), sp('Black pepper')] },

  // ---- South Indian ------------------------------------------------------
  { name: 'Idli sambhar', baseServings: 4, ingredients: [gr('Idli rice', 300), lg('Urad dal', 150), lg('Toor dal', 150), fz('Mixed vegetables', 200), sp('Sambhar masala')] },
  { name: 'Gits uttapam', baseServings: 4, ingredients: [gr('Uttapam mix', 400), onion(150), tomato(120), prod('Capsicum', 100), cn('Oil', 40)] },

  // ---- Continental / fusion ---------------------------------------------
  { name: 'Sandwich', baseServings: 4, ingredients: [pc('Bread slices', 16), prod('Cucumber', 150), tomato(150), dy('Butter', 80), dy('Cheese slices', 8, 'g')] },
  { name: 'Pasta', baseServings: 4, ingredients: [gr('Pasta', 400), tomato(250), prod('Capsicum', 120), dy('Cheese', 120), cn('Olive oil', 40)] },
  { name: 'Panini', baseServings: 4, ingredients: [pc('Panini bread', 8), dy('Cheese', 150), prod('Capsicum', 120), tomato(120), cn('Olive oil', 30)] },
  { name: 'Wrap', baseServings: 4, ingredients: [pc('Tortilla wraps', 8), dy('Paneer', 250), prod('Capsicum', 120), onion(120), sp('Peri peri masala')] },
  { name: 'Vegi bowl', baseServings: 4, ingredients: [gr('Rice', 350), lg('Rajma', 150), fz('Sweet corn', 150), prod('Lettuce', 100), cn('Olive oil', 30)] },
];

/**
 * Map a schedule spelling variant (lowercased) to a canonical RECIPE_CATALOG
 * name. Only variants whose spelling differs from a catalog name need an entry;
 * exact matches resolve directly.
 */
export const DISH_ALIASES: Record<string, string> = {
  // dals & khichdis
  dal: 'Dal fry',
  'daal fry': 'Dal fry',
  'daal bhat': 'Dal bhat',
  'daal bhaat': 'Dal bhat',
  'dal bhaat': 'Dal bhat',
  daalbhat: 'Dal bhat',
  'daal palak': 'Dal palak',
  'daal bhati': 'Daal bati',
  'mung ni daal': 'Mung daal',
  'mung ni dal nu sakh': 'Mung daal',
  'vagareli khichdi': 'Masala khichdi',
  'vaghareli khichdi': 'Masala khichdi',
  'khichdi kadhi': 'Kadhi khichdi',
  'kadhi bhaat': 'Kadhi khichdi',
  'pulao kadhi': 'Kadhi khichdi',
  // chana
  'chole chana': 'Chole',
  'chole channa': 'Chole',
  'chana masala': 'Chole',
  'desi channa': 'Desi chana',
  // paneer
  'plak paneer': 'Palak paneer',
  'matter paneer': 'Mataar paneer',
  'paneer bhurji amritsari': 'Paneer bhurji',
  'surati paneer gotalo': 'Paneer bhurji',
  'surati veg cheese gotalo': 'Paneer bhurji',
  'cheese butter masala': 'Paneer butter masala',
  'paneer lavabdar': 'Paneer butter masala',
  'paneer patiyala': 'Paneer butter masala',
  'paneer pasanda': 'Shahi paneer',
  'paneer khoya': 'Shahi paneer',
  'paneer kali mirch': 'Shahi paneer',
  'paneer tikka masala': 'Paneer Tikka',
  'paneer pulao': 'Veg pulao',
  'paneer kathi roll': 'Wrap',
  frankie: 'Wrap',
  // aloo / bataka
  'aloo matar': 'Aloo mattar',
  'aloo matter': 'Aloo mattar',
  'aaloo methi': 'Aloo methi',
  'aloo gobi': 'Flower bataka',
  'kobi bataka': 'Cabbage bataka',
  'cobbige batakar': 'Cabbage bataka',
  'aloo cabbage': 'Cabbage bataka',
  'dingli bataka': 'Dungli bataka',
  'onion potato': 'Dungli bataka',
  'suki baji': 'Suki bhaji',
  'suki bataka bhaji': 'Suki bhaji',
  'aloo rasavda': 'Rasavala bataka',
  'rasavad bataka': 'Rasavala bataka',
  'rasavada bataka': 'Rasavala bataka',
  'tindoda bateka': 'Tindoda bataka',
  // veg
  tameta: 'Sev tameta',
  'veg kheema masala': 'Veg kheema',
  'veg pulao masala': 'Veg pulao',
  pulao: 'Veg pulao',
  'mung pulao': 'Veg pulao',
  'palak pulao': 'Veg pulao',
  'mix veg rice': 'Veg pulao',
  // chaat / street
  panipuri: 'Pani puri',
  'vada pau': 'Vada Pav',
  // rice / misc
  biriyani: 'Biryani',
  // dhokla family
  dhokda: 'Dhokla',
  'khatta dhokda': 'Dhokla',
  'gits khatadhokla + lili chatni': 'Dhokla',
  // baingan
  'ringan odo': 'Ringan bhartu',
  'ringan na paleta + sheero': 'Ringan bhartu',
  // mung spelling
  mug: 'Mung',
  // malai
  'malai pyaaz': 'Malai pyaz',
  // pav bhaji spelling
  pavbhaji: 'Pav bhaji',
};
