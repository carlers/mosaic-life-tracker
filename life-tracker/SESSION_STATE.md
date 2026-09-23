# Session state

Updated: 2026-09-23
Current task: focused app performance optimization pass — continuation

## Active user prompt

> go on

## Parent prompt

> do a focused optimization pass to speed up performance of this app

## Progress

1. **Done — recovery/base selection.** Read `AGENTS.md`, the latest session state, roadmap/workflow docs, current Preview source, recent performance-pass history, and the latest Verify build output. The prior pass is already complete on Preview; this continuation starts from current Preview head `91ddb80576df52f13a70c5c775a5752f867a1148`.
2. **In progress — profile the next runtime/startup bottlenecks.** Re-check global providers, eager startup modules, route chunking, conversation/unread aggregation, animation ownership, and current entry/precache measurements. Select only behavior-preserving changes with a measurable or directly testable reduction in work.
3. **Pending — write spec/performance regression contracts first.** Add focused contracts for the selected hot paths before implementation and capture meaningful red where practical.
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
- Latest production build observed before this continuation: entry ~864.17 kB raw / 270.57 kB gzip; app-assets gzip ~558.8 kB; precache ~1.934 MB.
- Prior performance pass already reduced calendar mounted grids, stabilized mapped RxDB identity, removed redundant Home Swiper observers, reduced person-carousel animation/controller work, and made conversation aggregation single-pass.
