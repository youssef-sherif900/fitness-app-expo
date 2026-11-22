# Frontend PRD Addendum v1.1

Amendments to fold into `Fitness-App-Frontend-PRD.txt` v1.0. The original text stays
intact; this addendum records verified implementation facts, resolves ambiguities, and
adds requirement IDs for behaviour the current PRD leaves implicit.

Status: proposed 2026-11-21, based on the client at `e2a3bb1` and the backend at
`325243d`.

## A. Corrections to the baseline

| PRD statement | Correction |
|---|---|
| Stack is Expo SDK 57 | The installed package is **Expo SDK 58** (`expo ^58.0.19`), React Native 0.88, React 19.3. The README still says 57; `package.json` wins |
| §8: “sends batches to the batch sync endpoint” | The client drains a **per-item queue** one request at a time and pulls a hardcoded **20-day** window. No batch endpoint or cursor exists |
| §8: local SQLite holds “food logs, weights, measurements, workouts, sets, saved meals, cached catalogs” | Only `food_logs`, `weights`, and `sync_queue` exist locally. Everything else is online or absent |
| §10: “typed API client generated from the OpenAPI spec” | The client is hand-written (`src/api/endpoints.ts`), not generated |
| §11: “all strings externalized; RTL” | Strings are inline; there is no `i18n/` layer or RTL support |
| §14: `src/realtime/`, `src/i18n/`, `e2e/` | None exist |

## B. New and amended requirements

### B.1 Auth and session

**ONB-2A — Refresh must send the token the server authenticates.**
The refresh request must place the refresh token in the `Authorization: Bearer` header
(the backend resolves the user from the bearer token), or the backend must explicitly
accept a body token. Acceptance: an expired access token is refreshed once, the original
request is replayed, and the user stays signed in; concurrent 401s share one refresh.

**ONB-2B — Social sign-in field.**
The client must send `id_token` (not `token`) to `POST /auth/social`, plus `device_id`.
Acceptance: Apple and Google buttons exist, a failed verification shows a field error,
and no token is logged.

**ONB-2C — Verification and reset screens.**
Add verify-email (resend + deep-link handling) and forgot/reset password screens using
the existing endpoints. Acceptance: a user can complete both flows without leaving the
app.

### B.2 Nutrition

**FOOD-1A — Empty-state fallback.**
Search must never dead-end: show local recents/frequent first, then
`GET /foods/popular`, then the search prompt. Acceptance: a brand-new account sees
suggestions and can log a food in ≤3 taps.

**FOOD-3A — Saved-meal management.**
Saved meals must be editable (name/items) and reorderable, and a quick-add path must be
reachable for foods that are not in the catalog. Acceptance: rename, remove an item, and
log a custom quick entry without creating a catalog food.

**FOOD-5A — Edit gesture.**
The PRD says “swipe to edit or delete”; the implemented interaction is tap-to-edit plus a
delete action with 5-second undo. Either implement swipe actions or amend the PRD to
“tap to edit; destructive actions confirm or undo.”

**NUT-1A — Deficit inputs.**
The weekly deficit is intake-only until exercise burn is available. The UI must state
this (it currently does). Acceptance: the label remains visible whenever burn is not
included.

**NUT-1B — Coach-managed targets.**
When `source === "trainer"`, hide recalculation and explain that the coach manages the
target. Acceptance: no client action can overwrite a coach target.

### B.3 Body and progress

**BODY-1A — Measurements.**
Add waist/hip/chest/arm/thigh (and optional body-fat) entry, list, edit and delete, with
the same local-first behaviour as weight. Backend support is required first.

**PRG-1A — Range selector and adherence.**
Add 7/30/90-day range selection, logging adherence, and strength charts. Acceptance:
the weight trend and deficit recompute for the selected range without refetching all
history.

### B.4 Training

**TRN-1A — “Next workout” is not the first day.**
Define how the next session is chosen (weekday schedule, rotation, or last completed +
1). The current client always displays day 1. Acceptance: after finishing a session the
next session advances, including across weeks.

**TRN-1B — Editable drafts and program list.**
Saved programs must be editable (`PUT /training/programs/:id/days` with
`expected_version`), archivable, and listable. Acceptance: a user can reopen a draft,
change a day, publish, and archive an old program without recreating it.

**TRN-2A — Exercise library surface.**
Provide a standalone library with text search, muscle **and equipment** filters, custom
exercises, and per-exercise history. Acceptance: the library is reachable without
starting a program.

**TRN-3A — Workout player.**
Define the runtime contract and build: start from a program day or empty, prefilled sets
from last performance, per-set client UUIDs, rest timer + local notification, add/swap,
finish summary, offline queue, keep-awake. Acceptance: a full session can be completed
in airplane mode and replays without duplicates.

**TRN-3B — Duration exercises.**
Timed exercises need a duration field/unit. Storing seconds in `rep_range` and labelling
them “reps” is not acceptable.

**TRN-4A — History and records.**
Add past sessions, PRs, and weekly volume per muscle group, using
`GET /progress/personal-records` and `GET /progress/weekly-volume`. Acceptance: after a
completed session, history and volume update.

### B.5 Trainer

**TR-3A — Roster truth.**
Status, last activity, adherence and alert badges must come from the API; do not
hardcode “Active”. Add search/filter. Acceptance: a paused or inactive client is
visually distinct.

**TR-3B — Remove empty tabs.**
`inbox`, `templates`, `alerts`, `profile` are 0-byte routes. Either implement them or
remove them from the tab bar until they exist. Acceptance: no tab opens a blank screen.

**TR-4A — Client detail with locked states.**
Scopes the client has not granted must render as a locked state, never an error.

### B.6 Cross-cutting

**SYNC-1 — Batch and cursor.**
Replace the per-item drain with the PRD’s batch endpoint when available, and store a
per-device cursor. Until then, document the 20-day window as a known limit.

**SYNC-2 — Conflict policy.**
Specify per entity: server-wins quietly for reads, user-visible notice for edits,
tombstones for deletes. The current implementation keeps local edits while queued and
otherwise lets server rows win.

**ERR-1 — Retry and conflict classification.**
Only true validation/permission errors should become `failed`. 408/409/425/429 and 5xx
must retry with backoff. Acceptance: a version conflict is surfaced with a merge path,
not a dead queue item.

**A11Y-1 — Theme and contrast.**
All screens, including the trainer area, must use theme tokens and pass contrast in
light and dark. Acceptance: no hardcoded health-screen colors; light mode remains
readable.

**A11Y-2 — Localization.**
Externalize strings and support RTL before adding a second language. Acceptance: no
user-facing literals in components.

**TEST-1 — Test pyramid.**
Add unit tests (generator, trend/slope, nutrient scaling), component tests (serving
picker, log editor, sync badge), and Maestro flows (onboarding → log food → Today;
create program → publish → start). Acceptance: CI runs lint, typecheck and tests on every
MR.

**NFR-1 — Performance verification.**
Measure cold start, search latency, and 90-day chart render against PRD §13 on a
mid-range Android device; record results in the repo.

## C. Definition of done (replaces §18 until amended)

A feature is done when:

1. It is reachable from the navigation model and guarded correctly.
2. It has loading, empty, error and offline states.
3. Destructive actions have undo or confirmation.
4. It works in light and dark mode with theme tokens.
5. Controls have roles/labels and ≥44 pt targets.
6. It has at least one automated test (unit/component/E2E as appropriate).
7. The matching handbook page and `CHANGELOG.md` are updated in the same MR.
8. No new contract drift is introduced; payload changes update both repos’ docs.

## D. Open decisions to close

- Refresh-token transport (header vs body) — must be decided with the backend.
- Next-workout selection rule (weekday schedule vs rotation).
- Whether copying a template should auto-publish (current) or create a draft.
- Exercise media licence: confirm redistribution terms for the bundled RepDB stills.
- Units/localization target languages and whether display units are user-selectable in
  v1.
- Whether trainer mode ships as tabs or is deferred until client-detail exists.
