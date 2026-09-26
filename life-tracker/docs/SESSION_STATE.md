# Session checkpoint

Updated: 2026-09-27

Current task: comprehensively refactor Mosaic's automated test suite so it protects durable behavior and data-safety contracts without enforcing incidental UI implementation details, while reducing canonical CI cost.

Status: implementation is complete on `chatgpt/test-suite-cleanup`, targeting stable Preview `refactor/test-suite` from `dev` commit `bbace774345ddedb0d92a73e006e4d208f77a463`. No product/runtime source behavior was changed; the task changes tests, test commands, and testing documentation.

## Working set
- `AGENTS.md`, `docs/TEST_WORKFLOW.md`, `docs/PROJECT_REFERENCE.md`, `docs/PLAN.md`
- Vitest component/workflow suites under `tests/**`
- Playwright correctness/diagnostic suites under `tests/e2e/**`
- `package.json` test commands

## Completed substeps
- Audited the baseline: 99 Vitest files / 653 cases plus 36 Playwright executions; dev run 776 measured unit ~7.4s, handlers ~1.3s, DOM shards ~16.7s/~17.3s, browser shards ~23.7s/~41.6s.
- Codified a behavior-first test architecture in AGENTS, TEST_WORKFLOW, and PROJECT_REFERENCE §24.17. Visual/reference-app prose no longer implies CSS/class/RGB tests; browser geometry is reserved for interaction, accessibility, clipping, overflow, and usable-bound invariants.
- Preserved strong direct coverage for sync/mappings, account isolation/auth/offline behavior, destructive deletion/tombstones, Appwrite Function authorization/cross-user writes, queues/outboxes, row/schema parity, and privacy-minimal analytics.
- Removed presentation-only or duplicate suites for BottomNav styling, TaskBlock padding, Calendar overflow classes, duplicate CI classification, and folded PrimaryRoutePreview/ReactionRow coverage into related behavioral suites.
- Rewrote Calendar, Day View, Todo, MainLayout, BottomSheet, Settings, Category, message, reaction, and user-card tests to assert semantics/interactions instead of Tailwind classes, exact DOM ancestry, exact colors, or decorative layout implementation.
- Reduced the chat browser geometry matrix to representative phone/full and desktop/wide extremes; consolidated route and calendar ownership cases; removed pure appearance/Todo styling browser cases while retaining browser-only gesture, history, focus, overflow, accessibility, and geometry regressions.
- Tagged the zero-assertion performance probe `@performance`, excluded it from `test:browser-contract`, and added explicit `npm run test:performance`.
- Simplified workflow tests to durable verification invariants instead of exact YAML/cache-step shape.
- Focused run 808 passed after the test-file consolidation; discovery reported 93 Vitest files (unit 39, handlers 7, DOM 47).

## Remaining substeps
- Run exact-SHA full canonical acceptance on the final task checkpoint; fix any failures and rerun until green.
- Record final Vitest/browser case counts and CI wall times from that full gate against the dev run 776 baseline.
- Squash-merge the accepted task PR into `refactor/test-suite`.
- Verify the stable Preview branch Quality Gate and Vercel Preview deployment.

## Constraints
- No product/runtime behavior changes in this task.
- Do not weaken distinct data-safety, authorization, sync, offline, deletion, accessibility, or browser-only interaction failure coverage merely to reduce test counts.
- Stable Preview promotion stops at `refactor/test-suite`; do not merge to `dev` without explicit user instruction.

## Verification
- Baseline: dev Quality Gate run 776 passed on `bbace774345ddedb0d92a73e006e4d208f77a463`.
- Focused verification: run 808 passed; test discovery = 93 files (unit 39, handlers 7, DOM 47).
- Focused browser consolidation evidence: run 798 passed on `627ceb5d6de57866b86058860f4ef7926cbaf935`.
- Full canonical acceptance: pending on the final task SHA.
- Manual/device acceptance: not required because runtime product code was not changed.

Next action: run exact-SHA full canonical acceptance, repair any failures, then deliver by squash PR to `refactor/test-suite` and verify its Preview.

Blockers: none.
