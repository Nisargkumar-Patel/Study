# 🍳 Smart Kitchen — Inventory & Meal Planner

An **offline-first Progressive Web App (PWA)** that automates weekly dinner
planning for a shared household of **exactly 7 housemates**. It selects a weekly
menu, scales every recipe to 7 servings, subtracts what's already in the pantry,
tops up household staples, and produces a **deduplicated, mathematically precise
grocery list** that you can use **offline inside a grocery store**.

> Built with Next.js (App Router) · TypeScript · Tailwind CSS · MongoDB/Mongoose
> · IndexedDB (`idb`) · a custom Service Worker · AWS Textract & AWS SNS.

---

## ✨ Features

| # | Feature | Where |
|---|---------|-------|
| 1 | **Dynamic Portion Scaling** — every recipe scaled by `7 / baseServings` | `src/server/scaling.ts` |
| 2 | **Deduplicated Grocery Delta Engine** — `Required − Pantry` in canonical base units | `src/server/groceryEngine.ts` |
| 3 | **High-Capacity Staples** — `Target − Current` deltas auto-injected | `src/models/Staple.ts`, grocery engine |
| 4 | **Ad-Hoc Manual Additions** — append one-off items to the list | `src/components/ManualAddItem.tsx` |
| 5 | **Boolean Spices** — `inStock` toggle, bypasses unit math | `src/components/SpiceToggle.tsx`, grocery engine |
| 6 | **7-Housemate Rotation Solver** + SNS reminders | `src/server/rotation.ts`, `src/server/notifications.ts` |
| 7 | **Offline-First PWA** — read/check/edit offline, background sync | `public/sw.js`, `src/lib/idb.ts`, `src/lib/sync.ts` |
| 8 | **OCR Receipt Ingestion** — AWS Textract → Inventory | `src/server/textract.ts`, `src/app/api/ocr/route.ts` |

---

## 🧮 The Grocery Pipeline

```
Scaled Recipe Ingredients   (scaling.ts:  amount × 7/baseServings)
        − Current Pantry Inventory        (same base unit only)
        + Staple Delta                    (target − current, clamped ≥ 0)
        + Manual one-off additions
        ─────────────────────────────────
        = Final Deduplicated Grocery List (groceryEngine.ts)
```

**Strict base-metric standardization** (`src/lib/units.ts`): everything is stored
and computed in **grams (g)**, **milliliters (ml)**, or **pieces (pcs)**. Authored
units like `kg`, `tbsp`, `cup`, `dozen` are converted to base units on ingest and
only converted back to friendly units for display — eliminating rounding/unit
mismatch errors. **Spices** skip subtraction entirely and are tracked as a
boolean.

---

## 🗂️ Project Structure

```
smart-kitchen/
├─ public/
│  ├─ manifest.json        # PWA manifest
│  ├─ sw.js                # custom service worker (cache + background sync)
│  └─ offline.html         # offline fallback page
├─ src/
│  ├─ lib/
│  │  ├─ db.ts             # cached Mongoose connection
│  │  ├─ units.ts          # base-metric unit standardization
│  │  ├─ aws.ts            # lazy Textract + SNS clients
│  │  ├─ idb.ts            # IndexedDB store + mutation queue
│  │  └─ sync.ts           # background sync reconciliation
│  ├─ models/              # Mongoose: User, Recipe, Inventory, Staple, MealPlan
│  ├─ server/
│  │  ├─ scaling.ts        # portion scaling algorithm
│  │  ├─ groceryEngine.ts  # delta engine
│  │  ├─ rotation.ts       # 7-housemate rotation solver
│  │  ├─ notifications.ts  # AWS SNS dispatch
│  │  └─ textract.ts       # AWS Textract OCR handler
│  ├─ seed/                # dinner schedule seed data + seeder
│  ├─ components/          # React/Tailwind UI
│  └─ app/
│     ├─ layout.tsx, page.tsx, globals.css
│     └─ api/              # recipes, inventory, staples, mealplans,
│                          #   grocery, rotation, rotation/notify, ocr, sync
└─ ...config files
```

---

## 🚀 Getting Started

```bash
cd smart-kitchen
npm install

cp .env.example .env.local      # fill in MONGODB_URI (+ AWS keys if using OCR/SMS)

npm run seed                    # load the dinner schedule, 7 housemates, staples
npm run dev                     # http://localhost:3000
```

### Environment variables
See `.env.example`. At minimum set `MONGODB_URI`. AWS keys are only needed for
the OCR (`/api/ocr`) and SMS reminder (`/api/rotation/notify`) features.

---

## 🔌 API Reference

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/grocery` | Generate the weekly grocery list (POST accepts `manualItems`) |
| GET/POST | `/api/recipes` | List / upsert recipes |
| GET/POST/PATCH | `/api/inventory` | Pantry inventory; PATCH toggles spice `inStock` |
| GET/POST/PATCH | `/api/staples` | Staples with 7-person targets |
| GET | `/api/mealplans` | Weekly meal plans |
| GET/POST | `/api/rotation` | View / recompute cooking rotation |
| POST | `/api/rotation/notify` | Dispatch AWS SNS SMS reminders |
| POST | `/api/ocr` | Textract receipt → inventory (`?commit=true` to persist) |
| POST | `/api/sync` | Reconcile offline IndexedDB mutations |

---

## 📴 Offline Behavior

1. The service worker precaches the app shell, runtime-caches all
   `/_next/static/*` JS/CSS chunks (cache-first — they're content-hashed and
   immutable), serves navigations **network-first** with a cached fallback, and
   serves `/api/*` GETs **stale-while-revalidate**.
2. The grocery list is mirrored in **IndexedDB**, so it opens instantly with no
   network (e.g. inside a store).
3. Checking items off / adding manual items / toggling spices while offline
   writes to IndexedDB **and** queues a mutation.
4. On reconnect (`online` event or Background Sync `grocery-sync`), the queue is
   replayed to `/api/sync`, which returns the canonical list (last-write-wins)
   and refreshes the cache.
5. Checked-off state and manual additions are **persisted on the week's
   `MealPlan`** (`checkedItems`, `manualItems`), so they survive list
   regeneration and are shared across every housemate's device.

## ⚠️ Known Limitations

- **No authentication** — the API trusts anyone who can reach it. Fine on a
  private home network; put it behind auth (e.g. NextAuth, or a reverse-proxy
  basic auth) before exposing it to the internet.
- **Receipt OCR is synchronous** — Textract `AnalyzeExpense` with inline bytes
  handles single-page images up to 10 MB (the API returns 413 beyond that).
  Multi-page PDFs need the async Textract flow via the `RECEIPTS_S3_BUCKET`
  staging bucket (env var reserved, not yet wired).
- **SNS topic mode is a fallback only** — cook reminders are sent as direct
  per-cook SMS; the `SNS_TOPIC_ARN` topic (which broadcasts to all
  subscribers) is used only for cooks with no phone number on file.
- **Background Sync API** is Chromium-only; other browsers fall back to the
  `online`-event flush, which requires the tab to be open when connectivity
  returns.

---

## 🌶️ Seed Data Notes

The provided dinner schedule contained a few obvious date typos (e.g. a 2024 end
date on a 2025 week, a `03/17/2026` start, `12/30/2024 – 01/05/2024`). These are
normalized to valid, sensible dates in `src/seed/dinnerSchedule.ts` so the seeder
never crashes — adjust any specific week in-app if needed.

**Recipe coverage:** all 148 unique dishes in the schedule resolve to authored
ingredient lists, so every dish contributes scaled quantities to the grocery
list. The schedule uses many spelling variants for the same dish (e.g. `Dal fry`
/ `Daal fry`, `Biriyani` / `Biryani`, `Pani puri` / `Panipuri`); these are mapped
to a single canonical recipe via `DISH_ALIASES` in `src/seed/recipeCatalog.ts`,
so we keep ~75 canonical recipes instead of 148 near-duplicates. The seeder
creates a `Recipe` document under each exact schedule spelling (using the
canonical ingredients) so the grocery engine's exact-name lookups keep working.
A few closely-related dishes share a canonical recipe (e.g. several rich paneer
gravies map to `Paneer butter masala`; `Mung pulao` / `Palak pulao` map to
`Veg pulao`) — refine these in `recipeCatalog.ts` if you want per-dish accuracy.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **PWA:** custom `sw.js`, `manifest.json`, `idb` (IndexedDB), Background Sync
- **Backend:** Next.js Route Handlers (serverless)
- **Database:** MongoDB + Mongoose
- **Cloud:** AWS Textract (OCR), AWS SNS (SMS)
