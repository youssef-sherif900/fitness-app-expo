# Nutrition System — Frontend

How the client turns a profile into a calorie target, records food, and keeps the diary
usable offline. This page covers onboarding targets, food discovery, logging, saved
meals, the weekly deficit view, weight tracking, and the local sync pipeline.

> Source files: `src/app/(onboarding)/*`, `src/app/(client)/index.tsx`,
> `src/app/(client)/nutrition.tsx`, `src/app/food/*`, `src/features/nutrition/*`,
> `src/db/*`, `src/sync/index.ts`, `src/api/endpoints.ts`.

## 1. End-to-end flow

```
Onboarding draft ──PUT /me/profile──▶ profile + goal
        │
        └──POST /nutrition/targets/recalculate──▶ target (kcal + macros)
                                                      │
Today ◀── GET /nutrition/targets/current ─────────────┘
  │
  ├─ add food ─▶ SQLite food_logs ─▶ sync_queue ─POST /logs─▶ server
  ├─ scan/search ─▶ GET /foods, /foods/popular, /foods/barcode/:code
  ├─ save meal ─▶ POST /nutrition/saved-meals
  └─ weigh-in ─▶ SQLite weights ─▶ sync_queue ─POST /body/weights─▶ server
```

The diary is **local-first**. Screens read `food_logs` from SQLite; the network only
updates the local mirror in the background. Targets, saved meals and food catalog
search are online queries (React Query).

## 2. Onboarding and targets

### 2.1 Steps

`src/app/(onboarding)/` uses a shared `OnbShell` and a Zustand draft
(`src/onboarding/store.ts`). The flow has **6 steps** for lose/gain and **5** for
maintain (the weekly-rate step is skipped):

| # | Route | Collects | Notes |
|---|---|---|---|
| 1 | `/goal` | `lose`, `maintain`, `gain` | Sets a default rate: 0.5 kg/wk lose, 0.25 gain |
| 2 | `/body` | sex, birth date, height, weight, optional target weight | Zod: age 16–100, height 100–250 cm, weight 30–300 kg |
| 3 | `/activity` | sedentary → very_active | GoCardless-style five levels |
| 4 | `/rate` | weekly pace | Lose `0.25/0.5/0.75/1`, gain `0.1/0.25/0.5`; maintain skips |
| 5 | `/diet` | diet preferences + allergies (chips + free text) | Optional |
| 6 | `/targets` | — | Shows calculated kcal/macros and server notices |

### 2.2 Profile payload

`buildProfilePayload()` in `src/onboarding/store.ts` sends:

```json
{
  "goal": { "type": "lose", "target_weight_kg": 72, "weekly_rate_kg": 0.5 },
  "sex": "female",
  "birth_date": "1995-04-23",
  "height_cm": 168,
  "weight_kg": 80,
  "activity_level": "moderate",
  "diet_preferences": ["Vegetarian"],
  "allergies": ["Peanuts"]
}
```

`PUT /me/profile` is followed by `POST /nutrition/targets/recalculate`. The response is
stored in the onboarding store and rendered on `/targets` before the user taps **Start
tracking**.

### 2.3 Guardrails and validation

- A 422 response with field details is rendered as plain-language lines; the first
  field is mapped back to the step that can fix it (`screenForField`: rate → `/rate`,
  activity → `/activity`, body → `/body`, otherwise `/goal`).
- Offline during submission shows: “We need a connection to calculate your targets.
  Your answers are saved here…” The draft stays in memory for retry.
- The client never invents a target. If no target exists, Today shows “Your daily
  target will appear here once it is calculated.”

### 2.4 Onboarding completion

`isOnboarded()` (`src/onboarding/status.ts`) prefers `user.onboarding_completed` from
`GET /me`, then infers from an existing profile (height, weight, activity, goal), then
falls back to a SecureStore flag. `completeOnboarding()` writes the local flag and
refreshes `/me`. This fallback exists because the backend’s `/me` flag was not
confirmed when the client was written.

## 3. Today dashboard (`src/app/(client)/index.tsx`)

- **Date state** — defaults to today; `DateBar` moves by day. Opening a day calls
  `pullDay(day)` so dates outside the rolling 20-day window are fetched explicitly.
- **Target card** — remaining = target − eaten; macro bars for protein/carbs/fat.
  Target shape is tolerated with `num()` aliases (`kcal`, `calories`,
  `daily_calories`, `calorie_target`, `protein_g`, etc.).
- **Workout card** — shows the first day of the current program (see
  [workout-system.md](workout-system.md)). It is a display card only; it does not open
  a workout player.
- **Quick weigh-in** — accepts 20–500 kg, writes through `addWeight`, and shows the
  latest value plus change versus roughly one week earlier.
- **Meal groups** — Breakfast/Lunch/Dinner/Snacks with per-meal kcal and rows. Each row
  shows quantity × serving, kcal, and `· pending` while `server_id` is null.
- **Row actions** — tap a row for `LogEditor` (quantity in 0.25 steps, meal chips,
  delete). Delete hides the row immediately and commits after a **5-second undo**
  window.
- **Meal actions** — add food, save the meal as a saved meal, copy the meal to tomorrow.
- **Day actions** — copy previous day here, copy this day to tomorrow, open saved meals.
- **States** — skeleton, error, empty, pending markers, toast with undo.

## 4. Food discovery (`src/app/food/*`)

### 4.1 Search (`search.tsx`)

- 250 ms debounce; search runs at **2+ characters**.
- `GET /foods?q=&cursor=` returns `{data, next_cursor}`. The helper normalises to
  `{items, nextCursor}`; “Load more” appends pages and tracks the cursor per term.
- With no query, the screen shows **recent** foods from SQLite (grouped by `food_id`),
  a horizontal **frequent** row (most logged), and **popular** foods from
  `GET /foods/popular` for first-run users.
- Tapping a result opens the serving sheet; the info affordance opens details.
- Adding is optimistic: the row is inserted locally, a toast offers undo, and sync is
  requested immediately.
- The scan icon opens `/food/scan` with the current meal.

### 4.2 Serving picker (`src/features/nutrition/ServingSheet.tsx`)

- Chips for every serving with kcal; switching updates the preview live.
- Quantity stepper in 0.25 increments, minimum 0.25.
- Live kcal/P/C/F preview; “Add to {meal}”.
- Nutrients come from the selected serving, not the food row (`toFood`/`withServing`).

### 4.3 Barcode (`scan.tsx`)

- Explains camera use before the system permission prompt (PRD §12).
- Scans `ean13`, `ean8`, `upc_a`, `upc_e`.
- Found → serving sheet; 404 → “We do not have this product yet” with **Create custom
  food** prefilled with the barcode.
- Not granted/denied → “Search manually” path.

### 4.4 Details and reporting (`details.tsx`)

- Shows source (verified / your custom / community), barcode, default serving,
  per-serving macros, and one-tap add per serving.
- `POST /foods/:id/report` with a free-text reason (minimum 3 characters). The food
  stays usable while the report is reviewed.
- Custom foods expose **Edit custom food**.

### 4.5 Custom foods (`custom.tsx`)

- Create or edit with React Hook Form + Zod. One serving per food
  (`servings: [{label, kcal, protein_g, carbs_g, fat_g}]`).
- New food: `POST /foods`, then immediately logs it to the chosen meal.
- Edit: `GET /foods/:id` prefills the first serving; `PATCH /foods/:id`.
- Creating from a barcode passes `barcode` in the body.

## 5. Saved meals and copying

- **Create** — from a meal’s action sheet, snapshot every row (food/serving ids, name,
  qty, meal, kcal and macros) and send `POST /nutrition/saved-meals`.
- **List/relog** — `/food/saved` lists saved meals, shows total kcal, logs all items
  into the selected meal with one tap, and offers undo (each local id is deleted).
- **Delete** — confirmation dialog, `DELETE /nutrition/saved-meals/:id`.
- **Copy** — `copyLogs(fromDay, toDay, meal?)` duplicates local rows with fresh client
  UUIDs; every copy queues its own create and works offline.
- **Edit saved meal** — the API helper (`updateSavedMeal`) exists, but there is no UI.

## 6. Weekly deficit and target history (`src/app/(client)/nutrition.tsx`)

- `GET /nutrition/targets/current` → daily target and `source`
  (`auto`/`trainer`). Coach-managed targets hide the recalculate button.
- `GET /nutrition/targets` → history; each row shows kcal, delta vs the previous
  target, effective date, source, and reason.
- `GET /logs/summary?from=&to=` → seven-day bars, average intake across logged days,
  average deficit, and a dashed target line.
- Copy explicitly says **“Workout calories are not counted yet.”** The deficit is
  intake-only.
- **Recalculate now** calls `POST /nutrition/targets/recalculate` and invalidates the
  nutrition queries.

## 7. Weight and trend (`src/app/(client)/progress.tsx`)

- Quick add lives on Today; Progress reads all local weights and draws a smoothed line.
- `smoothedTrend()` mirrors the API: latest weigh-in per day, exponentially weighted
  moving average with alpha 0.1 adjusted for gap length.
- `weeklySlope()` reports kg/week; `describeSlope()` turns it into “Losing about 0.3 kg
  a week.”
- Edit changes only the value (the day is fixed) and queues a patch. Delete asks for
  confirmation and offers undo by re-adding the same value/day.
- Server rows arrive via the rolling pull (`GET /body/weights`); local pending edits
  are not overwritten while their queue item is pending/sending.

## 8. Local database and sync

### 8.1 Schema (`src/db/index.ts`)

| Table | Purpose | Key columns |
|---|---|---|
| `food_logs` | Diary mirror | `id` (client UUID), `server_id`, `food_id`, `serving_id`, `serving_label`, `name`, `meal`, `quantity`, `kcal`, `protein`, `carbs`, `fat`, `logged_on`, `deleted`, `created_at` |
| `weights` | Weigh-ins | `id`, `server_id`, `kg`, `measured_on`, `deleted` |
| `sync_queue` | Outbox | `id` autoincrement, `entity`, `op`, `entity_id`, `payload`, `status`, `attempts`, `last_error`, `created_at` |

`reconcile()` repairs legacy databases: it adds missing columns, or rebuilds a table
when the primary key/legacy NOT NULL columns make it unusable. Queue rows left in
`sending` after a crash are reset to `pending` on open. WAL is enabled. `resetDb()`
deletes the file on logout; Settings offers `resetLocalDatabase()` as a repair path.

### 8.2 Writes (`src/db/repos.ts`)

- `addFoodLog` picks the serving, scales nutrients by quantity, inserts the local row,
  and enqueues a create. Catalog foods send `food_id` + `serving_id`; quick/unknown
  entries send a snapshot name.
- `updateFoodLog` scales the snapshot by the quantity ratio; if the create is still
  pending it rewrites that payload, otherwise it queues an update.
- `deleteFoodLog` cancels a never-synced row entirely; otherwise it tombstones the row
  and queues a delete.
- `addWeight` sends `value_kg` and `${day}T12:00:00Z`.
- Queue counts power `SyncBadge` (“N pending”, “N couldn’t sync · Retry”, “Synced”).

### 8.3 Queue drain (`src/sync/index.ts`)

- Single-flight `runSync`; one item at a time (no batch endpoint is used).
- Create responses write `server_id` (and server-computed nutrients for logs) back to
  the local row.
- 4xx except 401/429 is treated as permanent and marked `failed`; offline/5xx/401 keep
  the item pending and stop the drain. `retryFailed()` requeues failed items.
- Triggers: app start/login, foreground, connectivity regained, and after each write.
- **Pull** — last 20 days of logs (`GET /logs?from=&to=`) plus all weights. Server rows
  win unless a local queue item is pending. Older days are fetched on demand.

## 9. Known defects and limitations

| ID | Issue | Impact | Where |
|---|---|---|---|
| `FE-N01` | Barcode scan only handles 404; any other API error leaves `busy` true with no message | Camera appears stuck after a server/network error | `src/app/food/scan.tsx:53-63` |
| `FE-N02` | Weekly deficit ignores exercise burn | Deficit can look smaller than reality; UI states this | `nutrition.tsx` |
| `FE-N03` | No UI to rename/edit a saved meal or reorder items | Must delete and recreate | `food/saved.tsx` |
| `FE-N04` | `addQuickLog()` exists but is never reachable from a screen (“can’t find it” path missing) | Users cannot log a food that is not in the catalog without creating one | `src/db/repos.ts:168` |
| `FE-N05` | `recentFoods`/`frequentFoods` group by `food_id` while selecting non-aggregated columns | SQLite may return an arbitrary row’s name/serving for a food logged with different servings | `src/db/repos.ts:200-225` |
| `FE-N06` | `logsSummary(from?, to?)` allows omitted dates; `/logs/summary` requires both | Any future caller that omits a date gets a 422 | `src/api/endpoints.ts:114` |
| `FE-N07` | Weight history is mirrored but the API’s `trend`/`slope` fields are ignored | Client recomputes; duplicated math can drift from the server | `src/sync/index.ts:181-211`, `features/body/trend.ts` |
| `FE-N08` | No measurements form (waist/body fat/etc.) | BODY-1 is only partially met | — |
| `FE-N09` | No progress photos, meal plans, grocery list, voice/text/photo logging | FOOD-4, NUT-2, BODY-2 unimplemented | — |
| `FE-N10` | Food catalog search is not cached for offline use; only diary and weights are local | Search requires a connection | — |

## 10. Change checklist

When touching nutrition:

1. Keep the local-first write path: insert local → enqueue → invalidate `['local']` →
   `requestSync()`.
2. Any new queued entity needs a branch in `send()`, a tombstone/delete rule, and a
   pull/merge rule.
3. Update this page, [api-integration.md](api-integration.md) if payloads change, and
   [CHANGELOG.md](CHANGELOG.md).
4. Add a unit test for nutrient scaling and a Maestro flow for search → serving →
   Today totals.
