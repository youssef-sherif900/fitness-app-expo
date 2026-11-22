# API Integration

How the client talks to the Laravel API: the wrapper, token lifecycle, endpoint
surface, envelope/pagination rules, idempotency, offline pull, and the places where the
client and server contracts currently disagree.

> Source files: `src/config.ts`, `src/api/client.ts`, `src/api/endpoints.ts`,
> `src/api/types.ts`, `src/sync/index.ts`. Backend contract details live in the backend
> repository `docs/api-endpoints.md`.

## 1. Base URL and request wrapper

```ts
// src/config.ts
API_URL  = (EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080').replace(/\/$/, '')
API_BASE = `${API_URL}/api/v1`
```

`api(path, opts)` in `src/api/client.ts`:

- Adds `Accept: application/json`; `Content-Type` when a body exists.
- Adds `Authorization: Bearer <access>` unless `auth: false`.
- Serialises `query`, dropping `undefined`, `null` and empty strings.
- Adds `Idempotency-Key` when supplied.
- Parses JSON when possible, returns the raw JSON (no unwrapping).
- Throws `ApiError(status, message, fields, retryAfter)` for non-2xx or network failure
  (`status = 0`, `isOffline`).

`unwrap<T>(json)` removes a single `{data: …}` envelope. Resource calls use it; list
helpers that need `meta`/`next_cursor` read the raw object instead.

## 2. Token lifecycle

| Token | Storage key | Sent as |
|---|---|---|
| Access | `access_token` (SecureStore) | `Authorization: Bearer` on every authenticated call |
| Refresh | `refresh_token` (SecureStore) | Should be the bearer token on `POST /auth/refresh` |
| Device | `device_id` (SecureStore, generated UUID) | `device_id` in login/register/social/refresh |

- Login/register responses are passed to `useSession.acceptAuthResponse`, which stores
  `access_token` (or legacy `token`) and `refresh_token`, then calls `GET /me`.
- `setSessionExpiredHandler` clears tokens, local DB, React Query cache, and returns the
  app to the auth stack.
- Concurrent 401s share one refresh promise (`refreshOnce`) and replay the original
  request once with `_retried: true`.

### `FE-D01` — refresh always fails against the current backend

`doRefresh()` posts:

```json
{ "refresh_token": "<token>", "device_id": "<uuid>" }
```

with **no `Authorization` header**. The backend’s `AuthController::refresh` resolves
`$request->user()` from the bearer token and expects a token with the `refresh`
ability; it does not read `refresh_token` from the body. Every refresh therefore
returns 401, and the client clears the session on the first expired access token.

**Fix direction:** send `Authorization: Bearer <refresh_token>` (and keep `device_id`
only if the endpoint needs it), or change the backend to accept the body token. Do this
in a dedicated auth MR with a test.

## 3. Endpoint surface

All paths are relative to `/api/v1`. “Used” means called from a screen/feature in this
snapshot.

### Auth and account

| Method | Path | Used | Notes |
|---|---|---|---|
| POST | `/auth/register` | yes | `name`, `email`, `password`, `password_confirmation`, `device_id`, `device_name` |
| POST | `/auth/login` | yes | `email`, `password`, `device_id`, `device_name` |
| POST | `/auth/social` | no | Helper sends `{provider, token, device_id}`; backend expects `id_token` (`FE-D02`) |
| POST | `/auth/logout` | yes | Remote revoke during sign-out |
| POST | `/auth/refresh` | yes | Broken (see `FE-D01`) |
| POST | `/auth/email/resend` | no | No verification UI |
| POST | `/auth/forgot-password` | no | No screen |
| POST | `/auth/reset-password` | no | No screen |
| GET | `/auth/sessions` | no | No session-management UI |
| DELETE | `/auth/sessions/:deviceId` | no | No session-management UI |
| GET | `/me` | yes | Bootstrap, after auth, onboarding completion |
| PUT | `/me/profile` | yes | Onboarding profile payload |
| GET | `/me/export` | no | No export button in Settings |
| DELETE | `/me` | yes | Settings delete account |

### Nutrition targets, foods, logs

| Method | Path | Used | Notes |
|---|---|---|---|
| GET | `/nutrition/targets/current` | yes | Today, Nutrition, onboarding fallback |
| GET | `/nutrition/targets` | yes | Target history |
| POST | `/nutrition/targets/recalculate` | yes | Onboarding + Nutrition |
| GET | `/foods?q=&cursor=` | yes | Cursor page `{data, next_cursor}` |
| GET | `/foods/popular?limit=` | yes | Empty-state suggestions |
| GET | `/foods/:id` | yes | Details, custom edit |
| GET | `/foods/barcode/:code` | yes | Scan |
| POST | `/foods` | yes | Custom food create |
| PATCH | `/foods/:id` | yes | Custom food edit |
| POST | `/foods/:id/report` | yes | Report reason |
| GET | `/nutrition/saved-meals` | yes | Saved meals list |
| POST | `/nutrition/saved-meals` | yes | Save current meal |
| PATCH | `/nutrition/saved-meals/:id` | no | No edit UI |
| DELETE | `/nutrition/saved-meals/:id` | yes | Saved meals list |
| GET | `/logs?date=` | yes | `pullDay` |
| GET | `/logs?from=&to=` | yes | Rolling 20-day pull |
| GET | `/logs/summary?from=&to=` | yes | Nutrition page (both dates sent) |
| POST | `/logs` | yes | Queue create, idempotency key |
| PATCH | `/logs/:id` | yes | Queue update |
| DELETE | `/logs/:id` | yes | Queue delete |
| POST | `/logs/copy` | declared | Helper exists; copy is done locally as individual creates |

### Body

| Method | Path | Used | Notes |
|---|---|---|---|
| GET | `/body/weights` | yes | Returns `{entries, trend, slope_kg_per_week}` |
| POST | `/body/weights` | yes | Queue create, `client_uuid`, `value_kg`, `measured_at` |
| PATCH | `/body/weights/:id` | yes | Queue update, `value_kg` |
| DELETE | `/body/weights/:id` | yes | Queue delete |

### Exercises, programs, workouts, progress

| Method | Path | Used | Notes |
|---|---|---|---|
| GET | `/exercises?per_page=100` | yes | Program wizard/builder only; no pagination |
| GET | `/exercises/:id` | declared | Not called |
| GET | `/training/programs/current` | yes | Today + Training |
| GET | `/training/programs/:id` | yes | Program detail |
| POST | `/training/programs` | yes | Create draft |
| PUT | `/training/programs/:id/days` | no | Helper unused; requires `expected_version` |
| POST | `/training/programs/:id/publish` | yes | Start program / after template copy |
| POST | `/training/programs/:id/archive` | no | No archive UI |
| GET | `/training/programs` | no | No program list |
| GET | `/training/templates` | yes | Create screen |
| POST | `/training/templates/:id/copy` | yes | Create screen |
| GET | `/workouts` | no | No history UI |
| POST | `/workouts` | no | No workout player |
| GET | `/workouts/:id` | no | No workout player |
| POST | `/workouts/:id/complete` | no | No workout player |
| POST | `/workouts/:id/cancel` | no | No workout player |
| GET | `/workouts/exercises/:id/last-performance` | no | No workout player |
| GET | `/progress/personal-records` | no | No PR UI |
| GET | `/progress/weekly-volume` | no | No volume UI |

### Trainer and misc

| Method | Path | Used | Notes |
|---|---|---|---|
| GET | `/trainer/clients` | yes | Read-only roster |
| GET | `/health` | no | Helper exists |

## 4. Error handling

`ApiError` carries:

- `status` — HTTP code, or `0` for network/offline.
- `message` — friendly text from `error.message`/`message`, with overrides for
  403/404/429/5xx.
- `fields` — first from `error.details`, then legacy top-level `errors`; values are
  string arrays.
- `retryAfter` — parsed `Retry-After` header for 429.

Screen patterns:

- Forms map 422 `fields` onto inputs (sign-in/register) or render plain-language lines
  with a “fix this” link (onboarding).
- 401 → refresh once; failure → session cleared by the global handler.
- 403 → “You don't have access to this yet.” (no locked-state UI yet).
- 429 → “Too many requests. Please try again shortly.” The numeric retry delay is not
  displayed, and React Query does not retry with backoff explicitly.
- Offline → `ApiError(0, 'You appear to be offline.')`; nutrition/weights continue from
  SQLite, other screens show their error state.

**Known drift:**

| ID | Drift | Impact |
|---|---|---|
| `FE-D02` | `socialLogin` sends `token`; backend validates `id_token` | Social sign-in would 422 (no screen uses it yet) |
| `FE-D03` | `logsSummary(from?, to?)` allows omitted dates; backend requires both | Unsafe helper; current caller passes both |
| `FE-D04` | Queue treats every 4xx except 401/429 as permanent | A transient 408/409/425, or a version conflict, becomes a failed item instead of a retry/merge |
| `FE-D05` | 401 on a replayed request (`_retried: true`) throws without clearing the session | Rare second-401 leaves stale tokens until the next request |
| `FE-D06` | `Idempotency-Key` is `entity:op:entity_id`; the server dedupes by `client_uuid` | Harmless while the key is stable, but the two mechanisms are independent; document one canonical rule |
| `FE-D07` | Client sends `logged_on`; backend derives the log day from `logged_at`/timezone | Logs can land on a different day for non-UTC users until the payload is aligned |
| `FE-D08` | Client sends `measured_at` at noon UTC; backend may store `measured_on` | Intended to preserve the local day, but should be verified per timezone |

## 5. Pagination and envelope conventions

- Cursor pages: `/foods` returns `{data: [...], next_cursor}`; exercise/program lists go
  through `unwrap` and then `pageItems()` accepts either an array or `{data: [...]}`.
- `unwrap` removes one `data` level only. If a payload is `{data: {data: [...]}}`, the
  second level remains; helpers are written defensively but this should be cleaned up
  when the API is frozen.
- `next_cursor` is treated as opaque. Search resets pagination when the debounced term
  changes.

## 6. Idempotency and offline replay

- Every queued create carries a client-generated UUID:
  - food log: `client_uuid` plus `qty`, `meal`, `logged_on`, kcal/macros, and either
    `food_id` + `serving_id` or a snapshot `name`.
  - weight: `client_uuid`, `value_kg`, `measured_at`.
- The queue sends one item at a time. On a lost response, the same payload/key is
  replayed; the backend’s unique `(user_id, client_uuid)` returns the original row.
- Successful creates write `server_id` back; later updates/deletes resolve through it.
- If a create is still pending, an edit rewrites the queued create instead of adding an
  update.
- A never-synced delete removes the local row and its queue history without a server
  call.

## 7. Pull and merge contract

`pull()` runs after every drain and:

1. Fetches `GET /logs?from=today-20&to=today` and `GET /body/weights`.
2. Upserts logs by `server_id` or `client_uuid`; local rows with pending queue items are
   **not** overwritten.
3. Upserts weights the same way (latest local edit wins while queued).
4. Leaves tombstoned rows hidden; a server delete is not explicitly reconciled beyond
   the row disappearing from the next pull (the local tombstone remains).

`pullDay(day)` fetches a single date for older diary navigation. It does not update the
sync cursor because the client has no cursor; the “window” is the hardcoded 20 days.

## 8. Time and units

- Calendar dates are local `YYYY-MM-DD` (`isoDate`, `addDays`).
- Weigh-ins are sent at noon UTC on the chosen local day to reduce off-by-one issues.
- The wire format is metric (kg, cm, kcal, grams). There is no user unit setting yet, so
  display is always metric.
- `new Date('YYYY-MM-DD')` is avoided in trend math; `parseDay()` constructs a local
  date to prevent UTC shifts.

## 9. Adding or changing an endpoint

1. Add the typed helper in `src/api/endpoints.ts`; keep `unwrap`/page handling
   consistent with neighbours.
2. Store tokens only through `tokenStore`; never log them.
3. Map new errors to friendly text and field errors.
4. If the call is part of an offline flow, add a queue branch and a merge rule first.
5. Document the payload and any drift here and in the backend
   `docs/api-endpoints.md`.
6. Add a contract test (backend feature test + a client unit test around the helper) in
   the same MR.
