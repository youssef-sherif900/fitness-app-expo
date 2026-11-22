# Workout System — Frontend

How the client creates, previews and publishes training programs, and what is still
missing from the workout experience. The **program authoring** flow is complete; the
**workout execution** flow is not built.

> Source files: `src/app/program/*`, `src/app/(client)/training.tsx`,
> `src/features/training/*`, `src/api/endpoints.ts`.
>
> **Branch note.** The exercise image assets and `ExerciseVisual` / `ExerciseThumb` /
> `ExercisePreviewSheet` source described in §7 are committed on
> `docs/nutrition-training-systems` @ `e2a3bb1`. The docs-only MR is based on `main`
> @ `089daea`, so those files are documented here but are not in its diff.

## 1. Scope today

| Capability | State |
|---|---|
| Current program + weekly schedule on Training tab | Implemented |
| Guided generator (goal, experience, days, equipment) | Implemented on device |
| Manual builder (days, exercises, sets/reps/rest) | Implemented |
| Copy a template and start it | Implemented |
| Save as draft, publish/start | Implemented |
| Exercise search/filter and illustrated preview | Implemented |
| Edit a saved program's days | **Not exposed in UI** (`updateProgramDays` helper unused) |
| Archive a program | **Not exposed in UI** (`archiveProgram` helper unused) |
| Program list/history | **Not exposed in UI** (`listPrograms` helper unused) |
| Workout player / set logging / rest timer / finish summary | **Missing** |
| Workout history, personal records, weekly volume | **Missing UI** (API helpers unused) |
| Custom exercises, per-exercise history | **Missing** |
| Trainer plan assignment/editing | **Missing** (backend also blocked) |

## 2. Program lifecycle

```
Create ──POST /training/programs──▶ draft
   │                                  │
   │                                  ├─ POST /training/programs/:id/publish ─▶ active
   │                                  │        (creates a version snapshot)
   │                                  └─ GET /training/programs/:id
   │
Template ──POST /training/templates/:id/copy──▶ draft ──publish──▶ active
```

- `POST /training/programs` validates `name`, `goal`, `experience_level`,
  `days_per_week`, and `days[].items[]` (`exercise_id`, `position`, `sets`,
  `rep_range.min/max`, optional `rest_seconds`). The client payload matches these
  rules exactly (`toCreatePayload`).
- The response is a draft (`status: "draft"`). `/program/:id` shows **Start this
  program**, which calls publish. Publishing requires at least one day with one
  exercise (client blocks earlier; server enforces too).
- `GET /training/programs/current` returns the active assignment/program. The Training
  tab renders its days. A 404 or empty body is treated as “No program yet”.

## 3. Entry screen (`src/app/program/create.tsx`)

Three paths:

1. **Guided setup** → `/program/wizard`
2. **Build my own** → `/program/builder`
3. **Templates** → `GET /training/templates`, each card shows goal, level and days;
   **Use this template** calls `copyTemplate` then `publishProgram` immediately.

Template behaviour differs from the manual flow: copying a template **starts it right
away** instead of leaving a draft. This is intentional in the current code but should
be confirmed as product behaviour (`FE-W05`).

## 4. Guided generator

### 4.1 Wizard steps (`wizard.tsx`, 5 screens)

| Step | Input | Default |
|---|---|---|
| 1 | Goal: strength, hypertrophy, endurance, fat loss, general | hypertrophy |
| 2 | Experience: beginner, intermediate, advanced | intermediate |
| 3 | Days per week: 1–7 | 3 |
| 4 | Equipment multi-select (11 options) | barbell, dumbbell, cable, machine, pull-up bar, bodyweight |
| 5 | Editable preview → **Save program** | — |

The generator runs **entirely on the phone** (`src/features/training/generate.ts`);
the backend has no generator route. If the exercise library fails to load or is empty,
the wizard shows an error/empty state and refuses to build.

### 4.2 Split selection (`splitForDays`)

| Days | Split |
|---|---|
| 1 | Full body |
| 2 | Full body A / B |
| 3 | Push / Pull / Legs |
| 4 | Upper A / Lower A / Upper B / Lower B |
| 5 | Push / Pull / Legs / Upper / Lower |
| 6 | Push A / Pull A / Legs A / Push B / Pull B / Legs B |
| 7 | Push / Pull / Legs / Upper / Lower / Full body / Core & conditioning |

Titles: 3/6 → “Push Pull Legs”, 4 → “Upper Lower”, 2 → “Full Body”, otherwise
“N-Day Split”.

### 4.3 Exercise slots

Each split day declares its muscles and ordered slots, e.g. Push =
`chest×2, front_delts×1, side_delts×1, triceps×2`. For each slot the generator:

1. Filters the library to exercises not already used that day, allowed by equipment,
   and matching the muscle as primary or secondary.
2. Prefers primary-muscle matches; falls back to secondary.
3. Sorts by fewest uses across the whole program, then name, so the same exercise is
   not repeated everywhere.
4. If a day ends with fewer than 5 items, fills from remaining exercises that train the
   day's focus.

Equipment rules:

- No equipment listed on an exercise → always allowed.
- Bodyweight-only selection → only `bodyweight` exercises.
- No equipment selected at all → all exercises allowed (the wizard blocks this, but the
  function tolerates it).

### 4.4 Prescription (`prescriptionFor`)

Base scheme by goal:

| Goal | Sets | Reps | Rest |
|---|---|---|---|
| strength | 4 | 3–5 | 180 s |
| hypertrophy | 3 | 8–12 | 90 s |
| endurance | 3 | 12–20 | 60 s |
| fat_loss | 3 | 10–15 | 60 s |
| general | 3 | 8–12 | 90 s |

Adjustments:

- Beginner −1 set; advanced +1 set (clamped 2–6).
- Isolation/core +2 low, +4 high reps.
- `exercise_type === "duration"` → 2–5 sets (after −1), 20–45 “reps”, 60 s rest.

> `FE-W10`: duration exercises reuse `rep_range` and the UI says “reps”, so a 20–45
> second hold is stored and displayed as reps. A duration field/unit is needed before
> timed exercises are trustworthy.

### 4.5 Validation (`validateProgram`)

- Name required, 1–7 days, at least one exercise overall.
- Per item: sets 1–30, `repMin >= 1`, `repMin <= repMax`, rest 0–600 s.
- Server accepts up to 14 days; the client caps at 7 (`FE-W12`).

## 5. Manual builder (`builder.tsx`)

- Starts from `emptyProgram()`: name “My program”, hypertrophy, intermediate, broad
  equipment, one empty day.
- Goal and experience chips, then the shared `ProgramEditor`.
- Saving creates a draft and navigates to `/program/:id`; publishing is a separate tap.

## 6. Program editor (`src/features/training/ProgramEditor.tsx`)

- Editable program name, day name, add/remove days (1–7).
- Add exercise via `ExercisePicker`; tap a row to edit.
- Item editor: sets, rest, reps low/high; **Swap exercise**; **Remove exercise**.
- Adding an exercise applies the goal/experience prescription automatically.
- Swapping keeps the old sets/reps/rest (`FE-W13`), which can be wrong when swapping a
  duration exercise for a rep-based one (or vice versa).
- Picker supports text search and muscle chips, with an info button that opens the full
  exercise preview.

## 7. Exercise library and media

- `GET /exercises?per_page=100` is fetched once per program flow (React Query stale time
  5 minutes). The client does not paginate beyond 100.
- `ExercisePicker` filters locally by name/muscle label and by primary/secondary muscle.
- **No standalone library route**; the library is reached through program authoring and
  program detail. Per-exercise history is not shown.
- Media (`ExerciseVisual`, `ExerciseThumb`) comes from generated RepDB assets:
  - `exerciseMedia.generated.ts` maps catalog `slug` (or name) → start/peak image
    sources; `stillsFor()` returns them.
  - `exerciseGuides.generated.ts` maps slug → difficulty, description, steps, tips.
  - The free tier provides two stills, so the UI crossfades Start ↔ Peak every 1.1 s
    instead of pretending to be a video. Reduce Motion freezes the pose.
  - Custom exercises without a slug show a barbell placeholder and “No illustration
    for custom exercises yet”.
- `ExercisePreviewSheet` shows the visual, primary/secondary muscles, equipment,
  difficulty, description, numbered steps, coaching cues, and the RepDB attribution.

## 8. Training tab (`src/app/(client)/training.tsx`)

- Header “Training” and a program summary card (goal, level, day count).
- Each day lists its exercises with thumbnail, sets × reps, and rest. Tapping opens the
  preview sheet.
- Empty/404 → “No program yet” with **Create a program** / **Browse templates**, both
  routing to `/program/create`.
- No start-workout button, no “next workout” calculation, no completion state. The
  Today card also only displays the first program day.

## 9. Workout execution gap (TRN-3 / TRN-4)

The API client already declares but **never calls**:

```ts
listWorkouts()        startWorkout(body)      getWorkout(id)
completeWorkout(id)   cancelWorkout(id)       lastPerformance(exerciseId)
personalRecords()     weeklyVolume()
```

Consequences:

- No workout session screen, set rows, prefilled “last time” values, rest timer, local
  notification, add/swap during a session, finish summary, or offline workout queue.
- No workout history, PR list, or weekly volume per muscle group.
- The local SQLite schema has no workouts/sets tables, and `sync_queue` has no
  workout/set branches, so adding the player requires schema + queue work.
- The backend has significant runtime defects in start/complete/PR/progression (see the
  backend handbook `docs/workout-system.md` §9). Fix those before wiring the player.

## 10. Trainer surface

`src/app/(trainer)/index.tsx` is a read-only roster from `GET /trainer/clients`.

- Shows the client’s initial, name, email, relationship status, scopes and connected
  date.
- Status badge is **hardcoded “Active”** for every row; `relationship_status` is not
  rendered (`FE-W14`).
- Error/empty/loading states exist; pull-to-refresh works.
- Hardcoded dark palette and fixed hex colors instead of theme tokens; the rest of the
  app supports light mode, so the roster can become light-on-light.
- `alerts.tsx`, `inbox.tsx`, `profile.tsx`, `templates.tsx` are **0-byte files**; the
  tab bar declares them, so opening a tab renders nothing (and bundling an empty route
  is fragile).
- No client detail, invite generation, plan/target editing, feedback, alerts, or
  template management (TR-2…TR-8 missing).

## 11. Known defects and limitations

| ID | Issue | Impact | Where |
|---|---|---|---|
| `FE-W01` | No workout player or set logging | TRN-3 unmet; users cannot execute a program in-app | — |
| `FE-W02` | History, PRs, weekly volume not rendered | TRN-4 unmet; helpers unused | `src/api/endpoints.ts:177-190` |
| `FE-W03` | A saved program’s days cannot be edited in the app | Users must recreate to change a plan | `program/[id].tsx` |
| `FE-W04` | No archive action | Old programs accumulate | `archiveProgram` unused |
| `FE-W05` | Template copy auto-publishes; manual create stays draft | Inconsistent confirmation/start behaviour | `program/create.tsx:22-32` |
| `FE-W06` | No program list/history | Cannot revisit drafts or past programs | `listPrograms` unused |
| `FE-W07` | Generator silently accepts days with <5 exercises | Thin sessions when the library lacks a muscle | `generate.ts:249-269` |
| `FE-W08` | No warning when no exercises match the chosen equipment | Day can end up with 0 items; save then fails server validation | `generate.ts` |
| `FE-W09` | Exercise fetch capped at 100, no pagination | Large catalogs are truncated | `endpoints.listExercises` |
| `FE-W10` | Duration exercises stored/displayed as reps | Timed holds are mislabelled | `generate.ts:162-173` |
| `FE-W11` | `startWorkout` contract undocumented in the client | Player work needs a payload spec first | — |
| `FE-W12` | Client caps programs at 7 days; API allows 14 | Arbitrary limit, not a bug by itself | `payload.ts:28` |
| `FE-W13` | Swapping an exercise keeps old prescription | Sets/reps/rest may not suit the new movement | `ProgramEditor.tsx:93-96` |
| `FE-W14` | Trainer roster hardcodes “Active” and ignores status/adherence | Misleading roster | `(trainer)/index.tsx` |
| `FE-W15` | Four trainer tabs are 0-byte modules | Blank tabs, fragile bundling | `(trainer)/*.tsx` |
| `FE-W16` | No custom exercises or per-exercise history | TRN-2 partially met | — |

## 12. Change checklist

When adding the workout player or editing programs:

1. Decide the runtime contract with the backend first (`POST /workouts`,
   `POST /workouts/:id/sets`, `POST /workouts/:id/complete`) and document it in
   [api-integration.md](api-integration.md).
2. Add `workouts` / `workout_sets` tables plus queue branches; sets need per-set client
   UUIDs for idempotent replays.
3. Prefill rows from `GET /workouts/exercises/:id/last-performance`.
4. Keep the Rest timer local and schedule a local notification; do not block on sync.
5. Add generator/trend unit tests and a Maestro flow: build program → publish → start →
   log sets → finish.
6. Update this page and [CHANGELOG.md](CHANGELOG.md).
