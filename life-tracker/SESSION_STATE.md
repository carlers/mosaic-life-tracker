# Session state

Updated: 2026-09-23
Current task: focused app performance optimization pass — continuation
Status: complete; optimized runtime checkpoint is verified and deployed to Preview.

## Active user prompt

> go on

## Parent prompt

> do a focused optimization pass to speed up performance of this app

## Progress

1. **Done — recovery/base selection.** Read `AGENTS.md`, the latest session state, roadmap/workflow docs, current Preview source, recent performance-pass history, and the latest Verify build output. Continuation started from Preview `91ddb80576df52f13a70c5c775a5752f867a1148`.
2. **Done — profile next runtime/startup bottlenecks.** Selected global BottomNav animation ownership, eager authenticated background modules, and conversation/unread aggregation work as behavior-preserving optimization targets.
3. **Done — spec-first regression contracts.** Added durable §15/§16 performance contracts plus focused BottomNav and unread-isolation tests. Verify #180 (`35818872035`) produced behavioral red for the persistent CSS-owned active-tab indicator; browser contracts remained green. The earlier #179 failure was test-lint only and is not behavioral evidence.
4. **Done — implementation.** Split unread summary context from conversation-detail context; skip conversation-list allocation/sort outside Messages/Chat; replaced the BottomNav Framer indicator with one persistent CSS-transformed dot; defer sync, realtime, and pending-message delivery modules until after shell commit/authenticated effects; module-load promises reset after rejection; lazy-load the Framer-based OfflineBanner only when offline.
5. **Done — focused/full green + measurement.** Task-branch Verify #184 (`35819343291`) passed 79 Vitest files / 537 tests and 20/20 Playwright browser contracts. Entry gzip moved 267,894 B → 249,870 B (-6.7%); Vite entry raw 864.17 kB → 828.49 kB (-4.1%). Aggregate app gzip rose 0.9% and unique precache raw rose 0.3% from extra split-chunk overhead; budgets remain green.
6. **Done — hosted checkpoint.** Task-branch Vercel deployment `dpl_FAyEP4ieEeinkDcXRv7MQfH3v22n` is READY.
7. **Done — Preview rollout.** Preview fast-forwarded to runtime checkpoint `8587d756d15622050f7f264483928b6a0e24d2b4`. Preview Verify #186 (`35819684374`) passed both repository and browser jobs; Preview Vercel deployment `dpl_AUTSX6bFZvGznquSpniWNo2eN2ve` is READY.
8. **Done — documentation/handoff.** Bundle trade-offs and architecture contracts are recorded. Remaining verification is optional real-device subjective smoothness/startup observation, not a blocker for the behavior-preserving optimization batch.

Roadmap pointer: This is a behavior-preserving optimization batch; no roadmap feature checkbox changes.
Blockers: None.

## Verification

- Baseline Preview: `91ddb80576df52f13a70c5c775a5752f867a1148`.
- Optimized runtime checkpoint: `8587d756d15622050f7f264483928b6a0e24d2b4`.
- Behavioral-red evidence: Verify #180 — BottomNav contract failed because the base implementation had no persistent CSS-owned indicator.
- Acceptance: task Verify #184 green (79 files / 537 tests; 20/20 browser), Preview Verify #186 green, task and Preview Vercel deployments READY.
- Build delta: entry raw -4.1%, entry gzip -6.7%, aggregate app gzip +0.9%, unique precache raw +0.3%.
- Prior performance pass remains in force: tighter calendar windowing, stable mapped RxDB identity, no redundant Home Swiper observers, memoized/stable person-carousel interactions, and single-pass inbox aggregation.
