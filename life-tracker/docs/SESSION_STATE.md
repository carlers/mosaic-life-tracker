# Session checkpoint

Updated: 2026-09-27

Current task: comprehensively refactor Mosaic's automated test suite so it protects durable behavior and data-safety contracts without enforcing incidental UI implementation details, while reducing canonical CI cost.

Status: audit complete; implementation is starting on `chatgpt/test-suite-cleanup`, based on stable Preview branch `refactor/test-suite` created from `dev` commit `bbace774345ddedb0d92a73e006e4d208f77a463`.

## Working set
- `docs/TEST_WORKFLOW.md`, `docs/PROJECT_REFERENCE.md`, delivery/testing guidance as needed
- Vitest projects under `tests/unit/**`, `tests/react/**`, `tests/components/**`, `tests/hooks/**`, `tests/handlers/**`
- Playwright contracts under `tests/e2e/**`
- `.github/workflows/quality-gate.yml`, test project/verification scripts where required

## Completed substeps
- Audited the current suite: 99 Vitest files / 653 cases plus 36 Playwright cases.
- Identified presentation-coupled UI assertions (Tailwind/class/DOM-parent/exact-color enforcement), overlapping calendar/Todo/Day View coverage, duplicated CI-classification tests, and workflow-shape tests that overfit YAML structure.
- Measured the latest green dev gate: unit ~7.4s, handlers ~1.3s, DOM shards ~16.7s/~17.3s, browser shards ~23.7s/~41.6s.
- Identified the zero-assertion Playwright performance probe as diagnostic work that should not be part of canonical correctness acceptance.

## Remaining substeps
- Rewrite testing doctrine so future agents test durable behavior/invariants rather than incidental presentation or component structure.
- Remove or rewrite brittle UI assertions and consolidate overlapping DOM/browser coverage without weakening data-safety, authorization, sync, offline, deletion, or accessibility contracts.
- Move diagnostic performance probing out of the mandatory browser correctness gate.
- Simplify duplicated workflow/tooling tests and test-project routing where beneficial.
- Run focused verification, then exact-SHA full canonical acceptance; repair failures until green.
- Benchmark before/after using CI evidence, squash-merge into `refactor/test-suite`, then verify stable Preview Quality Gate and Vercel deployment.

## Constraints
- No product/runtime behavior changes in this task.
- Preserve strong coverage for sync, mappings, auth/account isolation, handlers, tombstones, destructive data flows, offline queues/outboxes, accessibility semantics, and real browser-only interaction invariants.
- Stable Preview promotion stops at `refactor/test-suite`; do not merge to `dev` without explicit user instruction.

## Verification
- Baseline: dev Quality Gate run 776 passed on `bbace774345ddedb0d92a73e006e4d208f77a463`.
- Manual/device acceptance: not required for test-only behavior unless later changes alter runtime code.

Next action: update the durable testing rules, then refactor the highest-maintenance UI/browser suites and CI gate.

Blockers: none.
