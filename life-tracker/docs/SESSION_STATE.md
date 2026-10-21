# Session checkpoint
Updated: 2026-10-22 Asia/Manila

## Current task and evidence
- Issue #404 v0.40.5 large-screen Calendar split accepted by owner as fully working. PR #1191 promoted accepted stable Preview `feature/split-day-panel-dev-404-20261021@1e73d7bce6014475905342b2b5b7751145720846` to `dev@5e18064e516663aca71a930ffc6687cc0f2c46e7` with an identical Git tree. Promotion [Quality Gate 39639072325](https://github.com/carlers/mosaic-life-tracker/actions/runs/39639072325) SUCCESS.
- Official Vercel Git `dev` deployment `dpl_3iqzbAgPwkZ2Zt2q19TWUww35JgB` ERROR: same source and unchanged Home blocking gzip budget 381,000 B, Vercel computed 381,008 B (8 B over), despite stable canonical CI 380,987 B. Provider environment/compiled constants account for difference. Existing accepted stable Preview v0.40.5 is READY. Do not claim new dev deployment READY.
- Owner explicitly authorized **repair dev first**, then **implement proposed #404 improvements**: extend large-screen left/right panels to Todo List and Diary, and provide an in-view position/height switcher. Do not automatically promote that later feature from its Preview to dev/main.
- Issue #404 remains OPEN by explicit owner request.

## Dev provider size repair (internal version impact NONE)
- Task branch `chatgpt/404-dev-home-size-20261022` based on `5e18064e516663aca71a930ffc6687cc0f2c46e7`. Safe HomePage simplifications: coalesce idempotent (Set-backed) startup timing marks while retaining exact conditions; preserve both successful and failed Day View preload paths without redundant promise closures; let React's same-value state update bailout handle selected-person id, removing duplicate condition/dependency.
- Local sandbox with public Preview config built Home at 380,876/381,000 gzip after changes (baseline 380,888). This offers narrow headroom but **Vercel env remains authoritative**; verify exact stable provider build and repair if needed. No limit changes, auth/backend/UI changes or version bump. Unit/lint and GitHub focused/full gate remain to be verified; do not claim them green preemptively.
- Delivery route: task focused → new `fix/404-dev-home-size-20261022` stable Preview branch canonical and trusted Preview READY → explicit approval already granted for `dev` repair; promote its exact accepted tree through merge PR, verify dev promotion gate and Vercel READY. No Production.
- After dev READY, start next feature in separate v0.41.0 candidate and implement approved plan, with Todo/Diary shared Day View and mode controls, preserving existing defaults and gestures; verify normal gates and user-facing Preview, without dev promotion.

## Safeguards
- No budget bypass or CI weakening. Account/diary privacy unchanged.
- Preserve existing 0.40.5 Calendar snap/drag behavior; no unsupervised main/Production changes. Record actual QA and deployment evidence on issue #404.
