# Fitness App Frontend — Engineering Handbook

Living documentation for the Expo client. It explains what the app does **today**, how
the nutrition and training experiences are wired to the backend, where the client and
API contracts drift, and which PRD requirements are not built yet.

| | |
|---|---|
| Repository | `fitness-app-expo` (this repo) |
| Framework | Expo SDK 58 (`expo ^58.0.19`), React Native 0.88, React 19.3, TypeScript |
| Routing | Expo Router (file routes under `src/app/`) |
| API root | `http://10.0.2.2:8080/api/v1` by default (`EXPO_PUBLIC_API_URL`) |
| Local store | Expo SQLite (`fitness.db`) + SecureStore for tokens |
| Docs last verified | 2026-11-21, against `docs/nutrition-training-systems` @ `e2a3bb1` |
| Scope of this handbook | Client app: navigation, nutrition, training, sync, API usage |
| PRD | `Fitness-App-Frontend-PRD.txt` v1.0 (see [prd-alignment.md](prd-alignment.md)) |

> **Source of truth.** When this handbook and the code disagree, the code wins. The
> authoritative files are `src/app/`, `src/api/`, `src/db/`, `src/sync/`,
> `src/features/` and `app.json`. The README still says "Expo SDK 57"; the installed
> package is SDK 58. Treat `package.json` as the version source.

## 1. What this app is

A two-mode mobile client for a calorie-deficit fitness product:

- **Client mode** — onboarding, daily food diary, food search/scan/custom foods, saved
  meals, weekly deficit view, weight trend, and a training-program builder with an
  exercise library and illustrated previews.
- **Trainer mode** — a read-only roster of linked clients. The other four trainer tabs
  are declared but empty.
- **Offline-first nutrition** — food logs and weigh-ins are written to SQLite first and
  drained through a per-item sync queue. The diary and weight trend work without a
  connection.
- **Training is online-only today** — programs are fetched/saved through the API. There
  is no local workout session store and no workout player yet.

## 2. Stack and runtime

| Layer | Choice |
|---|---|
| Runtime | Expo SDK 58, React Native 0.88, New Architecture era packages |
| Language | TypeScript 6 (`strict` via `tsconfig.json`), path alias `@/* → src/*` |
| Navigation | Expo Router 58, typed routes disabled |
| Server state | TanStack Query v5 |
| Client state | Zustand v5 (`useSession`, `useSyncStatus`, onboarding draft) |
| Forms | React Hook Form + Zod |
| Local database | Expo SQLite (WAL, hand-rolled schema reconcile) |
| Secrets | Expo SecureStore (`access_token`, `refresh_token`, `device_id`, mode) |
| Camera | Expo Camera (barcode scanning) |
| Icons | `@expo/vector-icons` (Ionicons) |
| Gestures/animation | React Native Gesture Handler, Reanimated |

Not installed/used: realtime client (Reverb/socket), push notifications, media
upload/playback, health connectors, in-app purchases.

## 3. Run it

```bash
npm install
cp .env.example .env          # set EXPO_PUBLIC_API_URL to the machine's LAN IP
npx expo start                # dev server
npx expo start --android      # or --ios / --web
npx expo lint                 # lint (the only npm script besides start)
npx tsc --noEmit              # typecheck (no npm script exists)
```

The backend must be reachable from the device. `10.0.2.2` is the Android emulator
alias for the host; a physical phone needs the host LAN IP. HTTPS is not enforced by
the client (acceptable for local development only).

There is **no test suite and no E2E suite** in the repository. PRD §15 (testing) is
unimplemented; see [prd-alignment.md](prd-alignment.md).

## 4. Repository layout

```
fitness-app-expo/
├── src/
│   ├── app/                     Expo Router routes
│   │   ├── (auth)/              sign-in, register
│   │   ├── (onboarding)/        goal → body → activity → rate → diet → targets
│   │   ├── (client)/            Today, Nutrition, Training, Progress, Coach tabs
│   │   ├── (trainer)/           Clients tab + four empty tabs
│   │   ├── food/                search, scan, details, custom, saved (modals)
│   │   ├── program/             create, wizard, builder, [id]
│   │   ├── settings.tsx         account, mode, sync, reset, delete
│   │   └── _layout.tsx          auth/onboarding gate + providers
│   ├── api/                     fetch wrapper, endpoints, types, query client
│   ├── auth/session.ts          Zustand session/bootstrap/sign-out
│   ├── db/                      SQLite schema/reconcile + repositories
│   ├── sync/                    queue drain, rolling pull, triggers
│   ├── features/
│   │   ├── nutrition/           DateBar, MealChips, ServingSheet, LogEditor
│   │   ├── training/            generator, payloads, editor, picker, media guides
│   │   └── body/                trend math + line chart
│   ├── components/              design system (ui.tsx, Sheet, Toast, SyncBadge…)
│   ├── onboarding/              draft store + completion detection
│   └── theme/tokens.ts          light/dark color tokens
├── app.json                     Expo config (permissions, plugins)
└── docs/                        this handbook
```

## 5. Documentation map

| Read this | When you need |
|---|---|
| [nutrition-system.md](nutrition-system.md) | Targets, food search/scan/custom, diary, saved meals, weights, offline sync |
| [workout-system.md](workout-system.md) | Program wizard/builder, generator rules, templates, exercise library/media, workout gap |
| [screens-and-routes.md](screens-and-routes.md) | Every route, its guard, purpose, and states |
| [api-integration.md](api-integration.md) | Auth/refresh, endpoint surface, envelopes, pagination, contract drift |
| [prd-alignment.md](prd-alignment.md) | PRD requirement IDs vs implementation status |
| [prd-addendum-v1.1.md](prd-addendum-v1.1.md) | Text to fold into the next PRD revision |
| [CHANGELOG.md](CHANGELOG.md) | Documentation change history |

## 6. Cross-cutting conventions

- **Base URL** `src/config.ts`: `API_URL` (default `http://10.0.2.2:8080`, trailing
  slash removed) + `/api/v1`.
- **Envelopes** — Laravel resources wrap payloads in `{data: …}`; `unwrap()` in
  `src/api/client.ts` removes one `data` level. Cursor pages are `{data, meta}` or
  `{data, next_cursor}` depending on the endpoint, so list helpers accept both.
- **Auth** — bearer access token from SecureStore. `device_id` is a generated UUID sent
  on login/register/refresh. A 401 triggers one shared refresh attempt; on failure the
  session is cleared and the auth stack is shown.
- **Idempotency** — queued food-log and weight creates send an `Idempotency-Key` of
  `${entity}:${op}:${entity_id}` and include `client_uuid` in the body. The backend
  deduplicates by client UUID; replays return the original row.
- **Local-first writes** — nutrition/weight writes hit SQLite, then `sync_queue`, then
  the network. UI reads local rows and marks `server_id === null` as pending.
- **Dates** — `isoDate()` produces local `YYYY-MM-DD`; weigh-in creates send
  `${day}T12:00:00Z` to keep the intended local day. Food logs send `logged_on`.
- **Theme** — `useTheme()` exposes color/spacing tokens; `userInterfaceStyle` follows
  the OS. Trainer screens are the exception (hardcoded palette).
- **Accessibility** — most controls carry `accessibilityRole`/`accessibilityLabel` and
  ≥44 pt targets; several passive labels and the trainer palette still need work.

## 7. Current status (2026-11-21)

| Area | State |
|---|---|
| Auth (email/password), session bootstrap, logout, account deletion | Implemented; social login and password reset are not wired to screens |
| Token refresh | Implemented but **broken** against the backend (`FE-D01`) |
| Onboarding + target calculation | Implemented end to end (profile PUT + recalculate) |
| Today diary, date navigation, log edit/delete/undo, copy day/meal | Implemented |
| Food search, popular fallback, barcode scan, serving picker, report | Implemented |
| Custom foods (create/edit), saved meals (create/list/delete/relog) | Implemented |
| Targets, weekly deficit chart, target history/recalculate | Implemented (intake only; no exercise burn) |
| Weight quick-add, smoothed trend, edit/delete | Implemented |
| Program create (guided/manual/template), publish, view | Implemented; edit-days API helper unused |
| Exercise library, search/filter, illustrated previews and guides | Implemented (RepDB assets, generated) |
| Workout player, set logging, rest timer, history/PRs/volume UI | **Missing** (API helpers exist, unused) |
| Weekly check-in, coach linking, chat, notifications, subscription | **Missing** |
| Trainer roster | Read-only list; four tabs are 0-byte files |
| Measurements, progress photos, meal plans, voice/photo logging, health sync | **Missing** |
| Tests / E2E | **Missing** |

Defects are catalogued as `FE-Dnn` in the system pages and summarised in
[prd-alignment.md](prd-alignment.md). Fixes are deliberately out of scope for this
documentation change and should land as separate merge requests.

## 8. Working agreement for changes

1. One branch per change; open a merge request for review.
2. Update the matching doc page **in the same MR** as the behaviour change, and add a
   line to [CHANGELOG.md](CHANGELOG.md).
3. If a backend payload changes, update [api-integration.md](api-integration.md) and the
   backend handbook in the same release.
4. Add the first automated tests with any new feature: unit tests for generator/trend
   math, component tests for the serving picker and log editor, and Maestro flows for
   onboarding → log food → see Today totals.
5. Never commit `.env`, tokens, signed URLs, or generated media that is not licensed for
   redistribution.
