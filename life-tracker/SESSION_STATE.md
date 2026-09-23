# Session state

Updated: 2026-09-23
Current task: focused app performance optimization pass

## Active user prompt

> do a focused optimization pass to speed up performance of this app

## Progress

1. **Done — recovery/base selection.** Read `AGENTS.md`, prior `SESSION_STATE.md`, `PLAN.md`, remote/test workflows, current Preview source, and performance contracts. Based this task on Preview commit `5d29755a0bc34875097ff85b7bf476a358345c78`, which already contains the prior Home/calendar micro-optimizations.
2. **In progress — profile current runtime/bundle hot paths.** Inspect Home/person/calendar render windowing, background data work, motion-heavy repeated components, route/chunk boundaries, and current build/CI size evidence. Select only behavior-preserving changes with concrete expected cost reduction.
3. **Pending — spec/performance regression coverage.** Add focused tests/contracts for any performance invariant that is stable enough to verify without coupling tests to arbitrary implementation details. Capture red first where practical.
4. **Pending — implementation.** Apply the targeted runtime/render/bundle changes without visual/product behavior changes.
5. **Pending — focused verification and repair.** Run the relevant remote test project(s), inspect failures, and fix until focused checks are green.
6. **Pending — full acceptance gate.** Run the complete GitHub Verify workflow (repository + browser jobs), compare build/runtime evidence to the Preview baseline, and review the diff/test evidence.
7. **Pending — Preview promotion/deployment.** Fast-forward `preview` only to the exact green checkpoint, require Preview Verify + Vercel READY, then update this state with the verified SHA/run/deployment.
8. **Pending — final handoff.** Report concise bullet-point results, measured changes, manual frame-smoothness check, commits, verification, deployment, and remaining risk.

Status: Performance audit is active; no product behavior changes are intended.
Roadmap pointer: Todo List still awaits hosted/manual acceptance; this task is a behavior-preserving performance pass across the current app.
Blockers: None currently. Old merged task branches remain undeletable from this GitHub connector because it exposes no delete-ref operation.

## Verification

- Baseline Preview checkpoint before this task: `5d29755a0bc34875097ff85b7bf476a358345c78`; Preview Verify #150 passed and its Vercel deployment is READY.
- New-task focused/full verification: pending.

## Test-evidence review

- Pending until the selected optimization set is finalized.
