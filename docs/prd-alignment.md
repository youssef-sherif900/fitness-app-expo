# PRD Alignment — Frontend

What `Fitness-App-Frontend-PRD.txt` v1.0 asks for versus what the Expo client
implements in this snapshot. Status vocabulary:

- **Done** — behaviour exists and is reachable in the app.
- **Done\*** — exists, with a documented deviation.
- **Partial** — some requirement clauses are met, others are not.
- **Missing** — no reachable implementation.
- **Blocked** — client work depends on missing/broken backend routes.

Verified 2026-11-21 against `docs/nutrition-training-systems` @ `e2a3bb1`.

## 1. Summary

| Priority | Total | Done | Partial | Missing |
|---|---:|---:|---:|---:|
| Client P0 | 23 | 6 | 8 | 9 |
| Client P1 | 5 | 0 | 0 | 5 |
| Trainer P0 | 7 | 1 | 1 | 5 |
| Trainer P1 | 2 | 0 | 0 | 2 |

The nutrition loop (onboarding → target → search/scan → log → diary → weekly deficit)
is the strongest area. Execution of training, coaching/chat, notifications, billing and
health integration are absent.

## 2. Client requirements

| ID | Pri | Requirement (abridged) | Status | Evidence / gap |
|---|---|---|---|---|
| ONB-1 | P0 | Goal, body, activity, rate, diet/allergies; calculated targets; guardrails in plain language | **Done** | `(onboarding)/*`; profile PUT + recalculate; notices and field mapping |
| ONB-2 | P0 | Email/password, Apple/Google, verification, reset, auto refresh, clean logout | **Partial** | Email/password + logout done. Social helper sends wrong field (`FE-D02`), no social buttons. No verification/reset screens. Refresh broken (`FE-D01`), so “auto refresh” fails and clean logout runs early |
| HOME-1 | P0 | Eaten/remaining/target, macros, today’s workout, quick weigh-in, sync status, unread chat badge | **Partial** | All done except unread chat badge; workout card is display-only |
| FOOD-1 | P0 | Debounced search, recent/frequent, serving picker with live preview, meal, ≤3 taps | **Done** | 250 ms debounce, local recents/frequent, popular fallback, serving sheet, meal chips. Search → result → Add = 3 taps |
| FOOD-2 | P0 | Barcode scan; found add; not found custom food; permission rationale | **Done** | `food/scan.tsx`; rationale before prompt; 404 creates prefilled custom food |
| FOOD-3 | P0 | Custom foods, saved meals/recipes, one-tap relog, copy meal/day | **Partial** | Custom create/edit, saved meals create/list/relog/delete, copy day/meal done. No saved-meal edit/reorder; quick-add UI not exposed (`FE-N04`) |
| FOOD-4 | P1 | Voice/text/photo logging with editable portions | **Missing** | No speech, text parser, or camera-food flow |
| FOOD-5 | P0 | Day view by meal, date picker, swipe edit/delete, undo | **Done\*** | Day view, `DateBar`, edit modal, delete + 5 s undo. Edit is tap, not swipe |
| FOOD-6 | P0 | Report wrong food | **Done** | `food/details.tsx` → `POST /foods/:id/report` |
| NUT-1 | P0 | Target + source, weekly deficit chart, plain explanation of changes | **Done** | Nutrition tab: source (auto/coach), 7-day bars, average deficit, history reasons; intake only |
| NUT-2 | P1 | Meal plan by day, swap meal, log planned meal, grocery list | **Missing** | No screens or API usage |
| BODY-1 | P0 | Quick weigh-in, smoothed trend, measurements form, edit/delete | **Partial** | Weigh-in/trend/edit/delete done; no measurements form |
| BODY-2 | P1 | Private progress photos, compare, delete, hide previews | **Missing** | No photo capture/storage/compare |
| TRN-1 | P0 | Current program/weekly schedule, next workout; wizard; templates | **Partial** | Current program + day list, 5-step wizard, templates. No weekday schedule or true “next workout” selection (always first day) |
| TRN-2 | P0 | Exercise search/filter by muscle and equipment, media, instructions, custom exercises, per-exercise history | **Partial** | Search + muscle filter + illustrated media/instructions done. No equipment filter, custom exercises, or per-exercise history; library only reachable inside program flows |
| TRN-3 | P0 | Workout player: start empty/day, last-time prefills, rest timer + local notification, add/swap, summary, offline, keep awake | **Missing** | No player; workout endpoints unused; no local workout tables |
| TRN-4 | P0 | Past workouts, PRs, weekly volume per muscle | **Missing** | APIs declared, no UI |
| PRG-1 | P0 | Weight trend, average deficit, adherence, strength charts, range selector | **Partial** | Weight trend and average deficit done. No adherence, strength charts, or range selector; trend is fixed to all local history |
| CHK-1 | P0 | Weekly check-in form, review, proposed changes with reasons, accept, trainer approval | **Missing** | No check-in screen; backend job is also broken |
| COACH-1 | P0 | Invite/accept trainer, scopes, change/pause/revoke, access log | **Missing** | Coach tab is a placeholder; `GET /trainer/clients` is trainer-side only |
| CHAT-1 | P0 | Conversation list + thread, live updates, pagination, delivery/read | **Missing** | No realtime client or routes |
| CHAT-2 | P0 | Text/image/video/voice, share workout/log, upload/retry/processing, playback | **Missing** | No media pipeline |
| CHAT-3 | P1 | Presence and typing | **Missing** | — |
| CHAT-4 | P0 | Report/block/delete own message | **Missing** | — |
| SET-1 | P0 | Profile, units, language, notifications/quiet hours, health data, export, delete, sign out | **Partial** | Account display, mode switch, reset, sign out, delete done. No profile edit, units, language, notifications, health, or export UI. `exportMyData` unused |
| SUB-1 | P0 | Paywall, purchase, restore, price/cancel info, free tier | **Missing** | No billing SDK or screens |
| HLTH-1 | P1 | Just-in-time health permission, steps/active energy, show source | **Missing** | — |
| NOTIF-1 | P0 | Push token, reminders/chat alerts, deep links, no health in previews | **Missing** | Expo notifications not installed |

## 3. Trainer requirements

| ID | Pri | Requirement (abridged) | Status | Evidence / gap |
|---|---|---|---|---|
| TR-1 | P0 | Dual-role switch; trainers land on roster | **Done** | Settings switch; launcher redirects trainer mode to `/(trainer)` |
| TR-2 | P0 | Invite clients: code/link, share, list/revoke | **Missing** | — |
| TR-3 | P0 | Roster: status, last activity, adherence, alerts; search/filter | **Partial** | Roster list, scopes, connected date, pull-to-refresh. Status is hardcoded “Active”; no activity/adherence/alerts/search/filter |
| TR-4 | P0 | Client detail tabs (overview/nutrition/training/body/check-ins/chat) with locked states | **Missing** | — |
| TR-5 | P0 | Assign program/template; set targets; mark coach-managed | **Missing** | — |
| TR-6 | P0 | Comment on logs/workouts/check-ins; approve/override | **Missing** | — |
| TR-7 | P0 | Alerts for inactive/stalled clients with quick message | **Missing** | Alerts tab is a 0-byte file |
| TR-8 | P1 | Reusable program and meal-plan templates | **Missing** | Templates tab is a 0-byte file |
| TR-9 | P1 | Tablet/web dashboard for many clients | **Missing** | Open decision in PRD |

## 4. Cross-cutting PRD sections

| PRD section | Status | Notes |
|---|---|---|
| §7 UX principles | **Partial** | Speed-first and local-first nutrition are real; gentle tone is present. Every destructive action has undo/confirm. Training has no execution flow, so “never block on network” is only true for nutrition |
| §8 Offline-first data and sync | **Partial** | SQLite queue for food logs + weights, client UUIDs, retries, foreground/connectivity triggers. No workouts/sets/saved meals locally; no batch endpoint; no cursor; only a hardcoded 20-day pull |
| §9 Live chat and media | **Missing** | No socket client, channel auth, upload pipeline, or players |
| §10 State, API, error handling | **Partial** | Single wrapper, bearer, idempotency, friendly errors, optimistic nutrition writes. Not generated from OpenAPI; refresh broken; 429 retry-after not surfaced |
| §11 Design system and accessibility | **Partial** | Tokens, light/dark, core components, labels/44 pt on major controls. Trainer palette hardcoded and light-on-dark; no i18n/RTL; no haptics; reduce-motion respected for exercise stills |
| §12 Permissions, privacy, security | **Partial** | Camera rationale; tokens in SecureStore; delete account clears local data. No trainer consent screen, export UI, biometric lock, or progress-photo privacy |
| §13 Performance targets | **Unverified** | No profiling or performance tests. Local-first diary makes logging fast, but target metrics are unmeasured |
| §14 Project structure/environments | **Partial** | `src/app`, `api`, `db`, `sync`, `features`, `components`, `theme` match. No `realtime/`, `i18n/`, `e2e/`; no EAS profiles; no mock mode |
| §15 Testing strategy | **Missing** | No unit, component, or Maestro tests; only `expo lint` |
| §16 Observability/analytics | **Missing** | No analytics, crash reporting, or structured logs |
| §17 Release plan/store requirements | **Missing** | No EAS build profiles, store metadata, or privacy manifests |
| §18 Definition of done | **Not met** | No tests, no accessibility audit, no release build |

## 5. Backend dependencies

These frontend requirements cannot be completed until the backend exposes or fixes the
matching contract:

- **TRN-3/TRN-4** — start/complete workout, sets, PR and volume runtimes contain schema
  and namespace bugs (see backend `docs/workout-system.md` §9).
- **CHK-1** — `RunWeeklyCheckin` writes columns absent from `checkins`.
- **COACH-1/TR-5** — trainer plan/target editing is blocked because `TrainerAccess`
  always returns `false`.
- **CHAT-1…4, NOTIF-1, SUB-1, HLTH-1** — no routes or provider integration.
- **ONB-2** — refresh contract must be agreed (`FE-D01`), and social sign-in must accept
  the field the client sends (`FE-D02`).
- **BODY-1** — no measurements API.
- **NUT-2** — no meal-plan or grocery API.

## 6. Recommended next slices

1. **Auth correctness** — fix refresh + social field, add verification/reset screens,
   add contract tests.
2. **Workout execution** — build the player and local workout/set queue after backend
   runtime fixes; this unlocks TRN-3, TRN-4 and most of PRG-1.
3. **Offline completeness** — batch/cursor sync, workout/set tables, catalog caching.
4. **Settings/privacy** — profile edit, units, export, notification preferences.
5. **Trainer core** — client detail, invites, plan/target editing, alerts (depends on
   backend access fixes).
6. **Chat/media/billing/health** — larger integrations; schedule after the core loop is
   stable.
