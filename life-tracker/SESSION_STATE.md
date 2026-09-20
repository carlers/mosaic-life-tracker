# Session state

Updated: 2026-09-20
Current task: Phase 4.1 — instructions, reference discoverability, and enforceable project contracts
Status: implementation complete; runnable-workspace verification pending
Roadmap pointer: `PLAN.md` — Phase 4.1 is active by explicit user authorization; Phase 3.7 remains verification-pending and must not be marked complete yet
Checkpoint: Added a contributor-facing project-contract map, a durable contract-source/enforcement section, and `scripts/check-project-contracts.mjs`. `npm run contracts:check` validates authoritative entry-point existence, required cross-pointers, and local Markdown link targets; `npm run verify` now runs that guard before lint, tests, and build. The UI preservation rule remains active. The regression suite was previously pruned toward behavioral/state coverage.
Next action: Run `npm run contracts:check` and then `npm run verify` locally. If green, review the Phase 4.1 diff and mark the first Phase 4 checklist item complete. Phase 3.7 still requires its remaining staging/manual verification before its checkbox is closed.
Blockers: This web environment has repository API access only and cannot execute the checkout's npm commands.

## Phase 4.1 acceptance

- P4-1 — A contributor can identify the authoritative source for active rules, durable product/architecture contracts, roadmap state, current checkpoint, execution workflows, test workflow, telemetry, and bundle budgets from `README.md`.
- P4-2 — Documentation-only work has an explicit structural verification command.
- P4-3 — Normal `npm run verify` fails early when authoritative contract entry points or their local Markdown references drift.
- P4-4 — The checker is structural only and does not claim semantic completeness or implementation conformance.
- P4-5 — Existing Phase 3.7 verification status remains honest while Phase 4.1 proceeds by explicit sequencing override.

## Working set

- `AGENTS.md`
- `README.md`
- `PLAN.md`
- `SESSION_STATE.md`
- `docs/PROJECT_REFERENCE.md`
- `package.json`
- `scripts/check-project-contracts.mjs`

## Completed substeps

- Audited the active instruction/reference entry points and identified split discoverability plus missing structural enforcement.
- Added a Project contracts map to `README.md` with ownership by concern.
- Added `PROJECT_REFERENCE.md §0.1` defining contract sources and the enforcement boundary.
- Added `npm run contracts:check` to validate authoritative files, required entry-point pointers, and local Markdown targets.
- Wired `contracts:check` into `npm run verify` before lint/test/build.
- Updated `AGENTS.md` so documentation-only work runs the contract check and its reference map points contributors to the README index.
- Recorded the user's explicit authorization to start Phase 4 while Phase 3.7 remains verification-pending.

## Verification

- Not executed in this environment.
- `contracts:check`, lint, full tests, build, test discovery, and Phase 3.7 staging/manual checks remain unverified.
- Phase 4.1 is not marked complete in `PLAN.md` until the structural checker and required gate pass.
