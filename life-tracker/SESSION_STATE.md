# Session state

Updated: 2026-09-20
Current task: Phase 3.7 build-size repair — minimal PostHog transport
Status: minimal PostHog transport verified; live PostHog/browser checks pending
Roadmap pointer: `PLAN.md` — Phase 4.1 is active by explicit user authorization; Phase 3.7 remains verification-pending and must not be marked complete yet
Checkpoint: Phase 4.1 contract discovery remains implemented. Added a GitHub-connected-chat execution path: `.github/workflows/verify.yml` runs `npm ci` + the canonical `npm run verify` on `chatgpt/**` pushes, pull requests, or manual dispatch; stale runs cancel. Local verify still auto-copies output, while CI skips clipboard handling and retains logs in Actions. `docs/REMOTE_VERIFY.md` documents the phone-only loop and the one-commit-per-task history rule. AGENTS.md now prohibits micro-commit churn by default.
Next action: Inspect the automatically triggered GitHub Actions `Verify` run for this task commit. If red, repair from the Actions log without requiring user terminal relay; if green, use that result as the automated acceptance gate, then complete any remaining manual Phase 3.7 / UI checks before closing their roadmap items.
Blockers: Live PostHog dashboard/source-map verification and browser/device visual checks remain manual.

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
- `scripts/verify.mjs`\n- `src/lib/posthog.ts`\n- `tests/unit/posthog.test.ts`\n- `package.json`\n- `package-lock.json`
- `docs/REMOTE_VERIFY.md`
- `.github/workflows/verify.yml`

## Completed substeps

- Audited the active instruction/reference entry points and identified split discoverability plus missing structural enforcement.
- Added a Project contracts map to `README.md` with ownership by concern.
- Added `PROJECT_REFERENCE.md §0.1` defining contract sources and the enforcement boundary.
- Added `npm run contracts:check` to validate authoritative files, required entry-point pointers, and local Markdown targets.
- Wired `contracts:check` into `npm run verify` before lint/test/build.
- Added `scripts/verify.mjs` so verify output streams live and is automatically copied to the clipboard on exit; clipboard text strips terminal ANSI/control noise.
- Updated `AGENTS.md` so documentation-only work runs the contract check and its reference map points contributors to the README index.
- Recorded the user's explicit authorization to start Phase 4 while Phase 3.7 remains verification-pending.
- Added the GitHub Actions remote verification path for phone-only work.
- Added the one-commit-per-task rule and documented how remote CI fits that history contract.\n- Attributed the aggregate/precache regression to the PostHog browser runtime bundle.\n- Replaced runtime SDK usage with privacy-minimal direct flag/exception transport; source-map upload remains build-time through `@posthog/rollup-plugin`.

## Verification

- The prior local verify reached `contracts:check` green, then failed lint on a malformed `BottomSheet.test.tsx` comment; that syntax defect was repaired before this task.
- The new GitHub Actions verification run for this commit is pending.
- Phase 4.1 is not marked complete in `PLAN.md` until the structural checker and required gate pass.
