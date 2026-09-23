# Session state

Updated: 2026-09-23
Current task: focused app performance optimization pass — continuation

## Active user prompt

> go on

## Parent prompt

> do a focused optimization pass to speed up performance of this app

## Progress

1. **Done — recovery/base selection.** Read `AGENTS.md`, the latest session state, roadmap/workflow docs, current Preview source, recent performance-pass history, and the latest Verify build output. The prior pass is already complete on Preview; this continuation starts from current Preview head `91ddb80576df52f13a70c5c775a5752f867a1148`.
2. **Done — profile the next runtime/startup bottlenecks.** Selected three concrete costs: the global BottomNav pulls Framer Motion into the eager shell for one 4px indicator; authenticated background modules (sync/realtime/message delivery/social outbox) are statically reachable from startup; and the unread badge shares the full conversations context so ordinary message-list churn can rerender global nav and always builds/sorts conversation details off-route.
3. **In progress — write spec/performance regression contracts first.** Added durable §15/§16 performance contracts plus focused tests for unread-consumer render isolation and the persistent CSS-owned tab indicator. Push this test/spec checkpoint and capture red before implementation.
4. **Pending — implement measured wins.** Apply only changes that reduce startup parse/load, subscription work, render work, or repeated allocations without changing UI/product behavior.
5. **Pending — focused green checks + build measurement.** Use the relevant remote Verify run(s) to compare runtime/bundle contracts against the current baseline.
6. **Pending — full acceptance gate.** Require repository + browser jobs green and review test evidence.
7. **Pending — Preview rollout.** Fast-forward `preview` only to the exact green verified commit, confirm Vercel READY, then update this state with final run/deployment IDs.
8. **Pending — concise user handoff.** Report bullet-pointed performance wins, verification, deployment, and any remaining manual frame-smoothness check.

Status: Performance continuation is active; no product behavior or visual change is intended.
Roadmap pointer: This is a behavior-preserving optimization batch. Existing Todo/PWA manual acceptance remains independent.
Blockers: None currently.

## Verification

- Current baseline Preview Verify: latest green Verify on `91ddb80576df52f13a70c5c775a5752f867a1148`.
- Latest production build observed before this continuation: entry 864.17 kB raw / 270.57 kB gzip; app-assets gzip 558.8 kB; precache 1.934 MB.
- Selected continuation targets: isolate unread badge renders, skip off-route conversation-detail allocation/sort, remove the eager-shell Framer dependency used only by BottomNav, and defer authenticated background modules behind dynamic imports.
- Prior performance pass already reduced calendar mounted grids, stabilized mapped RxDB identity, removed redundant Home Swiper observers, reduced person-carousel animation/controller work, and made conversation aggregation single-pass.
