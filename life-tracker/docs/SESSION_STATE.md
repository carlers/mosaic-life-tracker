# Session checkpoint — Mosaic issue #408

Updated: 2026-10-13.
Current task: v0.25.2 diary/task drag UX Preview hardening, animated collision stability and exact-SHA hosted budget parity.
Next action: verify a targeted precache cap review on isolated task branch `chatgpt/408-hosted-precache-parity-20261013`, squash only to `feature/diary-408`, confirm canonical GitHub gate and Vercel Scratch READY for the resulting exact SHA, then request manual drag acceptance. Do not merge dev/main or close #408 without approval.

## Implemented
- Drag UX v0.25.2 squashed to stable Preview at `9bd902e56ddf05d0144e57604e899083535299d1` via PR #754.
- Direct-source Feedback on actual full-height Diary preview; no generic "Diary entry" decoy or faded duplicate; maintain the proven TaskItem custom overlay/sensor contract.
- Motion category/task/diary live insertion reflow; eliminate Motion-owned zero-height/opacity drag source; capture scroll geometry; optimistic diary placement until write settles; remount per day/account.
- Added unit outside-drop regression and Playwright source-visible/reusable after release/cancel, settled-gap and empty-category target assertions. Expanded `docs/MANUAL_TASK_REORDER_ACCEPTANCE.md`.
- Task focused, full production/PWA + 7/7 source size budgets, DOM and both final Playwright browser shards passed at task `d60056ff92086ed5bb4f022de56125c408b925e3`. The canonical gate for stable `9bd902e` is running.

## Hosted blocking result and narrow repair
- Vercel deployment `dpl_BLymkjjXmkVGRB7S5LALZtZS2aEA` of exact stable `9bd902e`: TS/Vite/PWA built; six budget metrics passed. Precache alone failed: 2,591,644 / 2,591,500 B (+144). Source CI was 2,589,393 B.
- Measured fix: only `config/build-size-budget.json` `limits.precacheUniqueBytes` becomes 2,593,000 (+1,500), giving 1,356 B hosted margin. Pinned baseline and remaining six limits unchanged. The budget review includes exact hosted evidence and the previous review chain.
- Stable squash `9bd902e` canonical browser shard 2 failed one intermittent empty-category drag (target migrated from Category 3 to Category 4 on release after previewing Category 3). The task's prior browser pass was green. Stabilize accepted task/diary targets when Motion alone moves a drop zone under a stationary pointer (3px tolerance); retain outside/cancel invariants. The Playwright case now waits for the projected gap to settle before release and rejects Category 4 takeover.
- The failed v0.25.2 Vercel deployment is NOT ready for manual acceptance; v0.25.1 was the last READY fallback before this attempt. Validate stable Vercel alias against final exact SHA, not just project URL.

## Unverified manual acceptance
- Long/short tasks and Compact/Expanded Diary content including emoji/multiple photos; real iOS/Android long-press and desktop mouse/trackpad movement.
- No ghost/decoy, no invisible rows after drop/cancel, uninterrupted smooth hover across populated/empty/collapsed categories, correct persistence and day/account switches.
- Social quote/reaction/scratch Function paths are unchanged by this patch; active compatible Scratch backend remains `6acd0a6643868c68508c` as recorded on #408.
