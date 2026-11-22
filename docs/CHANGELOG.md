# Documentation Changelog

All changes to the frontend handbook. Behaviour changes must add an entry here in the
same merge request.

## 2026-11-21 — v1.0 initial handbook

Verified against `docs/nutrition-training-systems` @ `e2a3bb1`.

### Added

- `README.md` — stack, run commands, repository map, current status, working agreement.
- `nutrition-system.md` — onboarding/targets, food search/scan/custom foods, serving
  picker, diary, saved meals, weekly deficit, weight trend, SQLite schema and sync
  queue, nutrition defects `FE-N01…FE-N10`.
- `workout-system.md` — program lifecycle, guided generator rules, manual builder,
  editor, templates, exercise media/guides, workout execution gap, defects
  `FE-W01…FE-W16`.
- `screens-and-routes.md` — full route inventory, guards, params, dead `/explore` route.
- `api-integration.md` — request wrapper, token lifecycle, endpoint usage table, error
  mapping, idempotency, pull/merge contract, drift `FE-D01…FE-D08`.
- `prd-alignment.md` — requirement matrix for all client/trainer IDs and PRD sections.
- `prd-addendum-v1.1.md` — corrections, new requirement IDs, definition of done, open
  decisions.
- `CHANGELOG.md` — this file.

### Findings recorded (not fixed here)

- `FE-D01` refresh posts the token in the body without a bearer header; the backend
  authenticates the refresh token as a bearer token, so refresh always fails and the
  session is cleared on the first 401.
- `FE-D02` social login sends `token`; backend expects `id_token`.
- `FE-D03` `logsSummary` permits omitted dates; backend requires `from` and `to`.
- `FE-D04` every non-401/429 4xx queue failure is marked permanent.
- `FE-N01` barcode scan does not surface non-404 errors and can leave the camera busy.
- `FE-N04` quick-add repository function is unreachable from any screen.
- `FE-W01`/`FE-W02` no workout player, history, PRs or volume UI.
- `FE-W14`/`FE-W15` trainer status hardcoded and four trainer tabs are 0-byte files.
- README still claims Expo SDK 57; installed package is SDK 58.

### Verified

- No automated tests or E2E flows exist; only `expo lint` is scripted.
- Local persistence covers food logs, weights and the sync queue only.
- Program payloads match the backend `ProgramService::dayRules()` shape
  (`rep_range.min/max`), despite the backend’s other training defects.

### Clarified

- `README.md` and `workout-system.md` now state that this docs-only branch is based on
  `main` @ `089daea`, while the exercise image/guide assets and components described in
  the workout page are committed on `docs/nutrition-training-systems` @ `e2a3bb1` and
  are therefore not part of this MR’s diff.

### Not changed

- No application code, assets, or configuration was modified.
- The pre-existing exercise media/guide work was already committed in `e2a3bb1`; this
  branch only adds `docs/`.
