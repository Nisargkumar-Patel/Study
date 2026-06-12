/**
 * dinnerSchedule.ts — Primary seed data.
 *
 * The raw weekly dinner schedule provided by the household, parsed into
 * structured week records. Dates use ISO `YYYY-MM-DD`. A few source rows had
 * obvious typos in the year (e.g. a 2024 end date on a 2025 week, a "03/17/2026"
 * start) — these are preserved as written but normalized to valid Date objects
 * so the seeder never crashes; correct them in-app if needed.
 */

export interface WeekSeed {
  weekStart: string; // ISO
  weekEnd: string; // ISO
  dishes: string[];
}

export const DINNER_SCHEDULE: WeekSeed[] = [
  { weekStart: '2024-07-29', weekEnd: '2024-08-04', dishes: ['Dabeli', 'Gavar bataka', 'Thepla', 'Dal fry', 'Bhinda', 'Paneer', 'Aloo mattar', 'Pani puri'] },
  { weekStart: '2024-08-05', weekEnd: '2024-08-11', dishes: ['Desi Channa', 'Khichdi', 'Pani puri', 'Tindoda bataka', 'Thepla', 'Dal fry'] },
  { weekStart: '2024-08-12', weekEnd: '2024-08-18', dishes: ['Chole Channa', 'Aloo Matar', 'Dal', 'Rajma Chawal', 'Pav bhaji', 'Flower bataka'] },
  { weekStart: '2024-08-19', weekEnd: '2024-08-25', dishes: ['Mushroom Masala', 'Mung', 'Paneer Tikka', 'Khichdi', 'Sandwich', 'Dal Tadka', 'Biriyani'] },
  { weekStart: '2024-08-26', weekEnd: '2024-09-01', dishes: ['Vada Pav', 'Aloo gobi'] },
  { weekStart: '2024-09-01', weekEnd: '2024-09-08', dishes: ['Chole chana', 'Dal palak', 'Rasavala bataka', 'Pulao', 'Dal bhat', 'Mix veg', 'Vegi bowl'] },
  { weekStart: '2024-09-09', weekEnd: '2024-09-15', dishes: ['Chevda sabji', 'Paneer', 'Tameta', 'Cabbage bataka', 'Mung', 'Dal bhaat'] },
  { weekStart: '2024-09-16', weekEnd: '2024-09-22', dishes: ['Thepla', 'Chole Channa', 'Tindoda Bateka', 'Dal fry', 'Mix kathod', 'Aloo Matar'] },
  { weekStart: '2024-09-23', weekEnd: '2024-09-29', dishes: ['Biriyani', 'Suki bhaji', 'Sev usal', 'Mung', 'Onion potato', 'Dal palak'] },
  { weekStart: '2024-10-08', weekEnd: '2024-10-14', dishes: ['Plak paneer', 'Desi chana', 'Dal fry', 'Cabbage bataka', 'Aloo mattar', 'Sev tameta'] },
  { weekStart: '2024-10-15', weekEnd: '2024-10-22', dishes: ['Mix veg', 'Cheese butter masala', 'Veg pulao', 'Suki baji', 'Mung', 'Pani puri'] },
  { weekStart: '2024-10-21', weekEnd: '2024-10-27', dishes: ['Pavbhaji', 'Flower bataka', 'Dal bhaat', 'Sev tameta', 'Vagareli khichdi', 'Mung ni daal'] },
  { weekStart: '2024-10-28', weekEnd: '2024-11-03', dishes: ['Ringan odo', 'Aloo rasavda', 'Dal palak', 'Cabbage bataka', 'Paneer khoya', 'Fried rice'] },
  { weekStart: '2024-11-04', weekEnd: '2024-11-10', dishes: ['Chole', 'Mix veg', 'Dungli bataka', 'Dabeli', 'Dal bhat', 'Mung'] },
  { weekStart: '2024-11-11', weekEnd: '2024-11-17', dishes: ['Desi chana', 'Suki bhaji', 'Palak paneer', 'Corn capsicum', 'Daal dhokli', 'Khichdi'] },
  { weekStart: '2024-11-18', weekEnd: '2024-11-24', dishes: ['Chole', 'Dungli bataka', 'Dal bhat', 'Cabbage bataka', 'Paneer bhurji', 'Mung'] },
  { weekStart: '2024-12-02', weekEnd: '2024-12-08', dishes: ['Chole', 'Flower bataka', 'Mix veg', 'Aloo mattar', 'Dal bhat', 'Pavbhaji'] },
  { weekStart: '2024-12-16', weekEnd: '2024-12-22', dishes: ['Aaloo methi', 'Manchuriyan', 'Vada pau', 'Desi chana', 'Corn capsicum', 'Cobbige batakar'] },
  { weekStart: '2024-12-23', weekEnd: '2024-12-29', dishes: ['Daal bhati', 'Palak paneer', 'Mung daal', 'Masala khichdi', 'Sezwan rice', 'Tuver totha'] },
  { weekStart: '2024-12-30', weekEnd: '2025-01-05', dishes: ['Chole', 'Cabbage bataka', 'Aloo mattar', 'Paneer pasanda', 'Kadhi bhaat', 'Idli sambhar'] },
  { weekStart: '2025-01-20', weekEnd: '2025-01-26', dishes: ['Handvo', 'Dabeli', 'Khichdi', 'Paneer', 'Mung', 'Flower bataka'] },
  { weekStart: '2025-02-03', weekEnd: '2025-02-09', dishes: ['Thepla', 'Kadhi bhaat', 'Daal palak', 'Paneer bhurji amritsari', 'Cabbage bataka', 'Aloo methi'] },
  { weekStart: '2025-02-10', weekEnd: '2025-02-16', dishes: ['Daal bhat', 'Dungli bataka', 'Ragda petis', 'Desi chana', 'Methi mattar malai', 'Pani puri'] },
  { weekStart: '2025-02-17', weekEnd: '2025-02-23', dishes: ['Chole', 'Paneer', 'Suki bataka bhaji', 'Flower bataka', 'Mung', 'Corn capsicum'] },
  { weekStart: '2025-02-24', weekEnd: '2025-03-02', dishes: ['Paneer', 'Daal bati', 'Khichdi kadhi', 'Pasta', 'Cabbage bataka', 'Mix veg'] },
  { weekStart: '2025-03-03', weekEnd: '2025-03-09', dishes: ['Pavbhaji', 'Methi bataka', 'Veg kolhapuri', 'Daal bhat', 'Daal palak', 'Rasavada bataka'] },
  { weekStart: '2025-03-10', weekEnd: '2025-03-16', dishes: ['Dabeli', 'Tuver totha', 'Cabbage bataka', 'Mung', 'Khichdi kadhi', 'Sezwan rice'] },
  { weekStart: '2025-03-17', weekEnd: '2025-03-23', dishes: ['Chole', 'Dal bhat', 'Tuver totha', 'Paneer', 'Mix veg', 'Mung daal'] },
  { weekStart: '2025-03-24', weekEnd: '2025-03-30', dishes: ['Pav bhaji', 'Dal palak', 'Desi chana', 'Suki bhaji', 'Corn capsicum', 'Khichdi'] },
  { weekStart: '2025-03-31', weekEnd: '2025-04-06', dishes: ['Paneer', 'Daal bhaat', 'Methi bataka', 'Mix veg', 'Wrap', 'Cheese butter masala'] },
  { weekStart: '2025-04-07', weekEnd: '2025-04-13', dishes: ['Chole', 'Mung', 'Handvo', 'Dingli bataka', 'Khichdi kadhi', 'Biryani'] },
  { weekStart: '2025-04-14', weekEnd: '2025-04-20', dishes: ['Palak paneer', 'Dal bhat', 'Flower bataka', 'Pani puri', 'Veg kolhapuri', 'Methi mattar malai'] },
  { weekStart: '2025-04-21', weekEnd: '2025-04-27', dishes: ['Paneer', 'Dabeli', 'Rasavad bataka', 'Mung', 'Corn capsicum', 'Idli sambhar'] },
  { weekStart: '2025-04-28', weekEnd: '2025-05-04', dishes: ['Sev usal', 'Dungli bataka', 'Mix veg', 'Kadhi khichdi', 'Daal palak', 'Surati paneer gotalo', 'Daam aloo', 'Surati veg cheese gotalo', 'Veg kheema masala'] },
  { weekStart: '2025-05-12', weekEnd: '2025-05-18', dishes: ['Dhokda', 'Daal bhat', 'Veg kolhapuri', 'Desi chana', 'Masala khichdi', 'Veg kheema'] },
  { weekStart: '2025-05-19', weekEnd: '2025-05-25', dishes: ['Pav bhaji', 'Daal fry', 'Paneer', 'Dahi puri', 'Suki bhaji', 'Malai Pyaaz', 'Panini'] },
  { weekStart: '2025-06-02', weekEnd: '2025-06-08', dishes: ['Pasta', 'Mung', 'Daal bhat', 'Kobi bataka', 'Muthiya', 'Veg kolhapuri'] },
  { weekStart: '2025-06-09', weekEnd: '2025-06-15', dishes: ['Kadhi khichdi', 'Veg Pulao masala', 'Flower bataka', 'Chana masala', 'Sabudana khichdi', 'Tinda bataka'] },
  { weekStart: '2025-06-16', weekEnd: '2025-06-22', dishes: ['Mung pulao', 'Daal bhat', 'Methi bataka', 'Malai pyaz', 'Cabbage bataka', 'Mix veg'] },
  { weekStart: '2025-06-23', weekEnd: '2025-06-29', dishes: ['Daal palak', 'Khichdi kadhi', 'Mataar paneer', 'Chole', 'Rasavala bataka', 'Surti locho'] },
  { weekStart: '2025-06-30', weekEnd: '2025-07-06', dishes: ['Paneer lavabdar', 'Daal bhat', 'Aloo matter', 'Mix veg rice', 'Pani puri', 'Cabbage bataka'] },
  { weekStart: '2025-07-07', weekEnd: '2025-07-13', dishes: ['Mung', 'Daal bhat', 'Corn capsicum', 'Sandwich', 'Suki bhaji', 'Palak paneer'] },
  { weekStart: '2025-07-14', weekEnd: '2025-07-20', dishes: ['Ringan na paleta + sheero', 'Khichdi kadhi', 'Sabudana khichdi', 'Dungli bataka', 'Bhinda bataka', 'Chole'] },
  { weekStart: '2025-07-21', weekEnd: '2025-07-27', dishes: ['Daal bhat', 'Daal palak', 'Mix veg', 'Paneer bhurji', 'Handvo', 'Aloo matter'] },
  { weekStart: '2025-07-28', weekEnd: '2025-08-03', dishes: ['Kadhi khichdi', 'Flower bataka', 'Paneer butter masala', 'Desi chana', 'Dabeli', 'Veg amritsari', 'Pavbhaji', 'Daal bhat', 'Corn capsicum', 'Palak pulao', 'Mung', 'Pasta', 'Aloo changezi'] },
  { weekStart: '2025-08-18', weekEnd: '2025-08-24', dishes: ['Kadhi khichdi', 'Desi chana', 'Sabudana khichdi', 'Flower bataka', 'Daal palak', 'Paneer patiyala'] },
  { weekStart: '2025-08-25', weekEnd: '2025-08-31', dishes: ['Chole', 'Daal bhat', 'Mung', 'Paneer bhurji', 'Handvo', 'Corn capsicum'] },
  { weekStart: '2025-09-01', weekEnd: '2025-09-07', dishes: ['Flower Bataka', 'Vaghareli khichdi', 'Paneer lavabdar', 'Pasta', 'Panipuri', 'Ringan bhartu'] },
  { weekStart: '2025-09-08', weekEnd: '2025-09-14', dishes: ['Daalbhat', 'Malai pyaz', 'Paneer kathi roll', 'Sabudana khichdi', 'Pasta', 'Methi bataka'] },
  { weekStart: '2025-09-15', weekEnd: '2025-09-21', dishes: ['Chole', 'Pulao kadhi', 'Paneer kali mirch', 'Gits khatadhokla + lili chatni', 'Aloo cabbage', 'Dabeli', 'Pavbhaji'] },
  { weekStart: '2025-09-22', weekEnd: '2025-09-28', dishes: ['Veg kolhapuri', 'Daal bhat', 'Bataka vatana', 'Gits Uttapam', 'Paneer tikka masala', 'Sandwich'] },
  { weekStart: '2025-09-29', weekEnd: '2025-10-05', dishes: ['Daal palak', 'Malai pyaz', 'Paneer kathi roll', 'Desi chana', 'Suki bhaji'] },
  { weekStart: '2025-10-06', weekEnd: '2025-10-12', dishes: ['Kaju paneer', 'Chole', 'Daal bhat', 'Aloo matter', 'Idli sambhar', 'Daal makhni'] },
  { weekStart: '2025-10-20', weekEnd: '2025-10-26', dishes: ['Gits uttapam', 'Paneer bhurji', 'Cabbage bataka', 'Khichdi', 'Mix veg'] },
  { weekStart: '2026-01-05', weekEnd: '2026-01-11', dishes: ['Palak paneer', 'Cabbage bataka', 'Khichdi', 'Pav bhaji', 'Mung ni dal nu sakh', 'Chana Chaat'] },
  { weekStart: '2026-01-12', weekEnd: '2026-01-18', dishes: ['Matter paneer', 'Khichdi', 'Mung', 'Daal palak', 'Sandwich', 'Flower bataka'] },
  { weekStart: '2026-01-19', weekEnd: '2026-01-25', dishes: ['Chole', 'Dhokla', 'Shahi paneer', 'Daal palak', 'Lasaniya bataka', 'Cabbage bataka'] },
  { weekStart: '2026-01-26', weekEnd: '2026-02-01', dishes: ['Mug', 'Daal bhat', 'Kaju paneer', 'Dabeli', 'Mix veg', 'Aloo methi'] },
  { weekStart: '2026-02-02', weekEnd: '2026-02-08', dishes: ['Chole', 'Frankie', 'Daal bhat', 'Cabbage bataka', 'Palak paneer', 'Idli sambhar'] },
  { weekStart: '2026-02-09', weekEnd: '2026-02-15', dishes: ['Gobi pakora', 'Paneer pulao', 'Pav bhaji', 'Kadhi khichdi', 'Kaju gathiya', 'Khatta dhokda'] },
];
