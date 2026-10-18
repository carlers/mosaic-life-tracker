# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 isolate day-level React reconciliation and TaskBlock memoization after v0.29.11 dev.

## Current accepted source
- Owner approved stable Preview→dev. [PR #960](https://github.com/carlers/mosaic-life-tracker/pull/960) MERGED at `dev@6ad5d271a4717e10ddd8be9ff74b846236407425`, first parent prior dev `bfb0fff0c1c283f599f32db8c2a426416fa65e7b`, second accepted stable Preview `4700bbea80e0c3f8a5160fda981a917883e69562`; identical source tree `312aa00634f197f0547cc2d2cdbcd92ec59df55f`. [Dev CI #39124311386](https://github.com/carlers/mosaic-life-tracker/actions/runs/39124311386) SUCCESS (promotion reuse); exact Vercel dev deployment `dpl_EMWazA7Qh9wqXQc5VRHFbCa1yNSu` READY. Main/Production/1.0 unchanged.
- #957 user-accepted Todo/Diary month fix CLOSED after dev integration. #858 OPEN, user explicitly requested deeper priority-3 performance work; further product promotions are not approved.

## Diagnostic evidence
- Nondeploying `chatgpt/858-calendar-reconcile-layout-lab-20261018` from dev passed 60 task-update +12 scheduling Chromium samples (2x CPU) in independent lab [#39125400859](https://github.com/carlers/mosaic-life-tracker/actions/runs/39125400859). Final focused [#39125774450](https://github.com/carlers/mosaic-life-tracker/actions/runs/39125774450) SUCCESS. Baseline vs strict reference-preserving unchanged day arrays on ONE task edit with 1000 tasks distributed over a month: React Profiler p50 **364.3→48ms**, DOM update **404.1→64.8ms**. At 1000 dense same day essentially identical (333ms); at 1000 historical years few tasks visible, 35ms both. If every task object is recreated the ~7x win disappears. Added startTransition to heavy updates completed slower in this synthetic test; forced layout-read proxy only 1–2ms vs hundreds of ms React render. No product code modified.
- Real **browser-local RxDB Dexie** query [#39125400859](https://github.com/carlers/mosaic-life-tracker/actions/runs/39125400859) showed a patched task emits a **new RxDocument reference** with updated title; previous doc reference retains old title. This single patch path supports identity-based stale-day rejection but does NOT yet prove remote synchronization, cross-account, date moves or in-place edit semantics. Do NOT blindly cache arrays in production.

## Current research branch
- `chatgpt/858-calendar-memo-signature-lab-20261018` branches from exact v0.29.11 dev and is **diagnostic ONLY**, never merge/deploy. Synthetic fixture reuses the previous lab harness in `tests/e2e/interaction-contract.tsx`. Experimental opt-in Vite-dev switches in TaskBlock.tsx/DayCell.tsx/MonthView.tsx activate `?memo=baseline|day|block|both` ONLY for this lab. Day memo uses an **immutable signature** of displayed task fields for equality; block memo tests stable task refs. No UI/style/backends or user data changes. Same-runner paired Playwright n=3 at 25/250/1000 dense, 1000 across month, 1000 years, both structurally shared and recreated RxDocument-like snapshots = 120 render samples.

## Next action
- Commit the research-only files/workflow and checkpoint; run focused CI plus independent paired lab on exact head, fix failures. Inspect true DOM-content correctness and p50 by scenario, plus no dense-day startup regression. If strong, implement a separate clean candidate with proper React purity, schema/account safety and DOM/gesture regression; no Preview→dev/main/Production merge without explicit approval.
