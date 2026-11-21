# Screens and Routes

Complete route inventory for the Expo Router tree, with the guard that makes each
screen reachable, what it does, and the states it handles.

> Source of truth: `src/app/`. Every file under `src/app/` is a route; `_layout.tsx`
> files define navigators. `typedRoutes` is disabled in `app.json`, so route strings are
> not type-checked.

## 1. Navigation model

`src/app/_layout.tsx` mounts a single root `<Stack>` and gates groups with
`Stack.Protected`:

| Guard | Group / route | Meaning |
|---|---|---|
| `status === 'out'` | `(auth)` | No access token |
| `status === 'in' && !onboarded` | `(onboarding)` | Signed in but setup incomplete |
| `status === 'in' && onboarded` | `(client)`, `(trainer)`, food modals, `program`, `settings` | Normal app |

`src/app/index.tsx` is the launcher: it waits for bootstrap, then redirects to
`/(auth)/sign-in`, `/(onboarding)/goal`, `/(trainer)` (trainer mode for a trainer
account), or `/(client)`.

Session bootstrap (`src/auth/session.ts`) reads the access token, calls `GET /me`, and
chooses trainer mode only when the saved mode and `user.is_trainer` both allow it.
Offline at launch keeps the session and falls back to the local onboarding flag.

## 2. Auth routes (`(auth)`)

| Route | File | Purpose | Notes |
|---|---|---|---|
| `/sign-in` | `(auth)/sign-in.tsx` | Email + password | Zod validation; 422 field errors attach to inputs; link to register |
| `/register` | `(auth)/register.tsx` | Name, email, password (≥8) | On success stores tokens and continues to onboarding |

Not implemented as screens, although API helpers exist: Sign in with Apple/Google
(`socialLogin`), email verification/resend, forgot password, reset password, session
list/revoke. The auth group has no “forgot password” link.

## 3. Onboarding routes (`(onboarding)`)

Anchor: `/goal`. Shared `OnbShell` provides progress, title, subtitle, Back/Continue.
Step count is 6 for lose/gain, 5 for maintain.

| Route | File | Purpose |
|---|---|---|
| `/goal` | `goal.tsx` | Lose / maintain / gain; seeds weekly rate |
| `/body` | `body.tsx` | Sex, birth date, height, current weight, optional target |
| `/activity` | `activity.tsx` | Five activity levels |
| `/rate` | `rate.tsx` | Weekly pace (skipped for maintain) |
| `/diet` | `diet.tsx` | Diet preferences and allergies; submits profile + recalculate |
| `/targets` | `targets.tsx` | Calorie/macro result, server notices, “Start tracking” |

`/rate` is skipped by navigating from `/activity` directly to `/diet` when the goal is
maintain. `/targets` can be opened directly; it falls back to
`GET /nutrition/targets/current`.

## 4. Client tabs (`(client)`)

Bottom tabs: **Today**, **Nutrition**, **Training**, **Progress**, **Coach**.

| Route | File | Purpose | Key states |
|---|---|---|---|
| `/(client)` | `index.tsx` | Today dashboard: remaining kcal, macro bars, workout card, quick weigh-in, meals, copy/save actions | skeleton, target error, diary error, empty, pending rows, undo toast |
| `/(client)/nutrition` | `nutrition.tsx` | Target + source, weekly deficit chart, target history, recalculate | skeleton, error, no history, coach-managed |
| `/(client)/training` | `training.tsx` | Current program, days, exercise preview | skeleton, error, 404/empty, program |
| `/(client)/progress` | `progress.tsx` | Smoothed weight trend, weekly slope, weigh-in list, edit/delete | skeleton, error, empty, delete confirm, undo |
| `/(client)/coach` | `coach.tsx` | Placeholder: “Trainer linking is coming” | static empty |

## 5. Food routes (root modals)

Declared in the root stack with `presentation: 'modal'` (except custom, which is pushed
inside the same protected stack).

| Route | File | Purpose |
|---|---|---|
| `/food/search` | `food/search.tsx` | Debounced search, recents, frequent, popular, pagination, serving sheet, scan |
| `/food/scan` | `food/scan.tsx` | Camera permission rationale, barcode scan, not-found → custom food |
| `/food/details` | `food/details.tsx` | Food detail, servings, add, report wrong data, edit custom |
| `/food/custom` | `food/custom.tsx` | Create/edit custom food (barcode prefill, log on create) |
| `/food/saved` | `food/saved.tsx` | Saved meals list, one-tap relog into a meal, delete |

Query params:

- `meal` — `breakfast|lunch|dinner|snack`, carried through search/scan/details.
- `id` — food id for details/custom edit.
- `barcode` — prefill for custom food after a failed scan.

## 6. Program routes (`program`)

Stack with hidden headers. Reachable only when signed in and onboarded.

| Route | File | Purpose |
|---|---|---|
| `/program/create` | `create.tsx` | Choose guided setup, manual builder, or template |
| `/program/wizard` | `wizard.tsx` | 5-step guided generator with editable preview |
| `/program/builder` | `builder.tsx` | Manual program editor from scratch |
| `/program/[id]` | `[id].tsx` | Program detail; publish/start; exercise previews |

There is no `/program` index route; `/program/:id` is the only way to view a program,
and it is reached after create/publish or from the Training tab.

## 7. Settings (root)

| Route | File | Purpose |
|---|---|---|
| `/settings` | `settings.tsx` | Account identity, client/trainer mode switch (dual-role only), sync badge, reset local data, sign out, RepDB attribution, delete account (type DELETE) |

Settings does **not** include profile editing, units, language, notification/quiet
hours, connected health data, or data export UI. `exportMyData` exists in the API
client but is unused.

## 8. Trainer tabs (`(trainer)`)

Bottom tabs: **Clients**, **Inbox**, **Templates**, **Alerts**, **Profile**.

| Route | File | State |
|---|---|---|
| `/(trainer)` | `index.tsx` | Read-only roster from `GET /trainer/clients`; 11 KB |
| `/(trainer)/inbox` | `inbox.tsx` | **0 bytes** |
| `/(trainer)/templates` | `templates.tsx` | **0 bytes** |
| `/(trainer)/alerts` | `alerts.tsx` | **0 bytes** |
| `/(trainer)/profile` | `profile.tsx` | **0 bytes** |

There is no client-detail route, invite flow, plan editor, target editor, or chat.

## 9. Unreachable / dead routes

| Route | File | Issue |
|---|---|---|
| `/explore` | `explore.tsx` | Leftover Expo starter screen (“This starter app includes example code…”). Not declared in the root stack and not linked from the app. References starter assets and `@/hooks/use-theme`. Safe to delete. |

## 10. Route-level behaviours worth knowing

- **Modal transitions** — food search/scan/details/saved are modals; closing returns to
  the screen that opened them. `router.back()` is used throughout, so deep links directly
  into a modal may land with no back stack.
- **Deep links** — scheme `fitness`. No route handlers exist yet for chat, invites, or
  check-in reminders, so the PRD deep-link requirement is unmet.
- **Back behaviour** — onboarding and program flows override back inside their headers;
  Android hardware back follows the stack.
- **Guards are group-level** — `settings`, `program`, and food routes are all inside the
  signed-in/onboarded guard, so a signed-out deep link cannot open them.
- **No not-found screen** — Expo Router’s default unmatched-route behaviour applies.

## 11. Adding a screen

1. Put route files only under `src/app/`; keep components/hooks in `src/features`,
   `src/components`, or `src/lib`.
2. Add the route to the correct `Stack.Protected` group in `src/app/_layout.tsx`, or to
   the relevant `_layout.tsx`.
3. Use `Screen`/`Txt`/`Card`/`Button` and theme tokens so light/dark both work.
4. Provide loading, empty, error and offline states; give destructive actions undo or a
   confirmation.
5. Add accessibility labels/roles and ≥44 pt touch targets.
6. Update this page and [CHANGELOG.md](CHANGELOG.md) in the same MR.
