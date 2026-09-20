# Session state

Updated: 2026-09-20
Current task: Phase 3.6 production build-size guard
Status: complete
Roadmap pointer: `PLAN.md` — Phase 3.6 complete; Phase 3.7 next
Checkpoint: Reviewed production byte ceilings are enforced and the full acceptance gate is green.
Next action: Plan the Phase 3.7 PostHog foundation with privacy-preserving defaults.
Blockers: none

## Working set

- `config/build-size-budget.json`
- `scripts/lib/build-size-guard.mjs`
- `scripts/check-build-size.mjs`
- `tests/unit/buildSizeGuard.test.ts`
- `package.json`
- `README.md`
- `PLAN.md`
- `docs/BUNDLE_AUDIT.md`
- `docs/PROJECT_REFERENCE.md`
- `SESSION_STATE.md`

## Completed substeps

- Measured the current production entry, aggregate JavaScript/CSS assets, and unique
  service-worker precache payload using exact raw and Node-gzip bytes.
- Established reviewed ceilings with about five percent headroom over commit `6fa2014`.
- Added budget schema validation, deterministic metric evaluation, and readable pass/fail
  output with byte overages.
- Added the size check to `npm run build` after generated service-worker validation and
  exposed `npm run build:size` for an existing `dist/`.
- Documented what the guard measures, what it does not measure, and the deliberate budget
  refresh protocol.
- Added four focused regression tests and captured structural red against the pre-change
  revision because the guard module did not previously exist.

## Remaining substeps

- none for Phase 3.6

## Temporary decisions

- Guard the entry raw/gzip size, aggregate app JS/CSS raw/gzip size, and unique raw precache
  size; retain the diagnostic audit for route closure and package attribution.
- Use approximately five percent headroom to catch meaningful drift without treating normal
  hash changes as growth.
- Budget increases require graph inspection and documentation; they are not an automatic
  response to a red build.

## Verification

- Pre-change isolated run: structural red (`build-size-guard.mjs` did not exist).
- Focused build-size suite: 4 tests passed.
- Existing `dist/` size check passed all five ceilings at the recorded baseline.
- Evidence review: 4/4 behaviors documented (3 added-red-green, 1 existing-indirect;
  3 structural red), with no manual or skipped rows.
- Discovery guard: 54 files mapped once (`unit=25`, `handlers=6`, `dom=23`).
- Full suite: 54 files / 467 tests passed.
- Lint, production build, generated PWA policy, build-size budgets, documentation links,
  and `git diff --check` passed.
