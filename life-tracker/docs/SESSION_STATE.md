# Session checkpoint

Updated: 2026-10-09
Current task: #412 automated test-suite audit — fail-closed discovery guard
Baseline: `dev` `281a95dde841bc12c9b8a2ba8374f1bdb5687dc1` (v0.7.1)
Task branch: `chatgpt/test-discovery-audit`
Stable Preview target: `refactor/test-discovery-audit`
Version impact: NONE; no app behavior, backend or UI changes.

## Objective and evidence

- v0.8.0 #410/#416 stays canonical-green on Preview `7d89b5f5` pending user hardware acceptance; do not promote it or depend on its code here.
- Audit #412 found existing shared Vitest projects, independent Playwright shards, production build and PWA budgets, contract guard, related-test focused CI and explicit manual/device boundary. Preserve these.
- Concrete test-discovery gap: guard globbed only `tests/**/*.test.ts[x]`; unsupported test-like names could be skipped by both runner and guard.
- Added candidate enumeration of all test-like files with single-owner classification, accepting existing Vitest patterns or documented `tests/e2e/**/*.spec.mjs`. Reject unsupported/misplaced/overlapping files with actionable errors.
- Added helper unit and subprocess regression tests; updated TEST_WORKFLOW.md.
- Historical CI examples #410/#416 browser wheel fixture and size-budget test drift show test-specific failures distinct from application defects; do not call them generic flakiness.

## Verification and delivery

- Task branch requires `[verify:focused]`, diff review and test discovery readback.
- On focused green, squash to stable `refactor/test-discovery-audit` Preview for canonical CI and Vercel READY; no Scratch backend/schema readiness required for internal tooling.
- Do not promote to dev/main without separate user approval. No manual acceptance needed for this non-UI change; no local/device checks claimed.

## Next action

Commit coherent source + tests + docs/checkpoint as one task commit, inspect focused CI, repair any red; then canonical Preview acceptance and issue #412 milestone evidence.
