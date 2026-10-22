# Session checkpoint
Updated: 2026-10-22 Asia/Manila
Current task: Integrate accepted #1185 category-color edits into current dev without regressing #404 large-screen layout. The #404 Todo/Diary panel work remains a separate active workstream.

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

## Issue #1185 dev integration (approved 2026-10-22)
- Owner explicitly accepted category-color Preview and authorized merge **to dev only**. Original accepted Preview `feature/category-color-1185-20261022@6dc93b23c4c4cbc92dbc80772f51daabaad15e83` (v0.41.0), canonical Quality Gate 39639900487 SUCCESS, trusted Vercel delivery 39640280309 SUCCESS READY.
- Original Preview started from pre-#404 dev, so direct promotion would drop accepted v0.40.5 large-screen source and source-tree parity. Current integration baseline: `dev@2dbc4c809ba9e4a939f526c2474e7c0a28e5df8b`. Reapply only #1185's editor/palette source and tests atop it, carrying v0.41.0; preserve #404 layout/hosting repair and its independent Todo/Diary workstream.
- Integration task: `chatgpt/1185-category-colors-dev-integration-20261022`. Stable Preview: `feature/category-colors-dev-integrated-1185-20261022`. GitHub issue #1185 stays open pending main acceptance.
- Verify focused CI for task, squash into stable Preview, canonical acceptance and exact-SHA READY trusted Preview, and merge Preview → dev after checking latest dev SHA and exact-tree promotion eligibility. This dev approval does not authorize main/Production or include #404 unfinished Todo/Diary features. Manual offline/sync/friend and device/theme acceptance remain unverified.

## #1185 dev hosting-size follow-up (internal, approved merge delivery)
- Dev PR #1204 merged exact accepted v0.41.0 Preview: `dev@13eb9de1a5ed0600f196e6a85b8069126f507c41`; first parent `2dbc4c8`, second `eba181c`, source tree identical to accepted Preview. CI run 39700024847 promotion-check and canonical-acceptance SUCCESS.
- Vercel Git deployment for this exact dev SHA `mosaic-life-tracker-lfp9i4isa-carls-projects-72516fde.vercel.app` **ERROR**: `homeClosureGzipBytes 381001/381000`, exceeding mandatory blocking budget by 1 byte. Stable exact Preview is READY, reflecting provider build differences. Never weaken the budget.
- Scoped internal repair based on dev: deduplicate preset-color matching in `ColorPalettePicker`, retain all palette selection semantics, color choices and legacy-color display. Task `chatgpt/1185-dev-vercel-budget-20261022`; stable `fix/1185-dev-vercel-budget-20261022`. Version stays v0.41.0 (no user-visible behavior change). Focused CI → full canonical + trusted Preview READY → exact-tree merge PR to dev; verify dev hosted READY. Production unapproved.
