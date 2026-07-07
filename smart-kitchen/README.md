# 🍳 Smart Kitchen — Inventory & Meal Planner

An **offline-first Progressive Web App (PWA)** that automates weekly dinner
planning for **any shared household** — 2 people or 12. It selects a weekly
menu, scales every recipe to the number of active members, subtracts what's
already in the pantry, tops up household staples, and produces a
**deduplicated, mathematically precise grocery list** that you can use
**offline inside a grocery store**.

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

cp .env.example .env.local      # set MONGODB_URI, HOUSEHOLD_PASSCODE, AUTH_SECRET

npm run seed                    # (optional) sample dinner schedule + staples
npm run dev                     # http://localhost:3000
```

### Environment variables
See `.env.example`. Required: `MONGODB_URI`, `HOUSEHOLD_PASSCODE`,
`AUTH_SECRET`. AWS keys are only needed for the OCR (`/api/ocr`) and SMS
reminder (`/api/rotation/notify`) features.

## 🔐 Authentication & Onboarding a New Household

The whole app sits behind a session gate (`src/middleware.ts`):

1. Deploy the app and set a `HOUSEHOLD_PASSCODE` (plus a random `AUTH_SECRET`).
2. Share the passcode with your housemates.
3. Each person opens the app and signs in with **their name + the passcode**.
   A new name automatically **joins the household** and takes the next cooking
   rotation slot — no fixed member count, no admin ceremony.
4. Sessions are HMAC-signed, HTTP-only cookies valid for 90 days, so offline
   queued changes still sync when the phone reconnects days later.

Manage members in the **🏠 House** tab: add/remove housemates, mark someone
"away" (they're skipped by the rotation **and** excluded from portion scaling),
and set the E.164 phone number used for SMS cooking reminders. The seeded 7
sample members can be removed there after your real household signs in.

Unauthenticated API calls get `401`; page visits redirect to `/login`. PWA
assets (`/sw.js`, `/manifest.json`, icons, the offline page) stay public so the
service worker can always install.

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

## 📱 Make It a Mobile App

Three paths, in increasing order of effort:

1. **Install the PWA (zero extra work — recommended first).** Host the app
   (Vercel + MongoDB Atlas free tiers work), then on each phone:
   *Android/Chrome:* menu → **Add to Home screen** (Chrome offers an install
   banner automatically). *iPhone/Safari:* Share → **Add to Home Screen**.
   You get a full-screen app with an icon, offline grocery list, and sync —
   this is exactly what the manifest + service worker were built for.
2. **Play Store via TWA (a day of work).** Use
   [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
   (`npx @bubblewrap/cli init --manifest https://your-host/manifest.json`) to
   wrap the hosted PWA in a Trusted Web Activity and publish the signed AAB to
   Google Play. No app code changes.
3. **Both stores via Capacitor (a weekend).** `npm i @capacitor/core
   @capacitor/ios @capacitor/android`, point the Capacitor WebView at your
   hosted URL (`server.url` in `capacitor.config.ts`), and build in
   Xcode/Android Studio. This unlocks native push notifications (replacing
   SMS), camera-native receipt capture, and App Store distribution. The
   backend/API stays exactly as-is.

## ⚠️ Known Limitations

- **Single shared passcode** — auth keeps strangers out and identifies members,
  but housemates are trusted equally (any member can manage the household).
  There are no per-user passwords or roles.
- **Async OCR polls in-request** — multi-page/large receipts poll Textract for
  up to ~50 s inside the API call (`maxDuration = 60`). On serverless plans
  with shorter function limits, retry the upload or run on a Node server.
- **SNS topic mode is a fallback only** — cook reminders are sent as direct
  per-cook SMS; the `SNS_TOPIC_ARN` topic (which broadcasts to all
  subscribers) is used only for cooks with no phone number on file.
- **Background Sync API** is Chromium-only; other browsers use the built-in
  fallbacks (30 s heartbeat while pending mutations exist + flush on tab
  focus/`online`), which require the app to be opened for the sync to run.

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
