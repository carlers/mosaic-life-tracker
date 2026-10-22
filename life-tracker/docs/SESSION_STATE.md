# Session checkpoint
Updated: 2026-10-22 Asia/Manila
Current task: Issue #404 large-screen Todo List and Diary side panels plus in-Day-View layout switcher, v0.41.0.

## Accepted baseline / prior dev repair
- Owner confirmed issue #404 Calendar split v0.40.5 visually bug-free, and approved stable Preview → dev while keeping #404 OPEN.
- Initial dev Vercel build failed unchanged Home bundle budget (381008/381000 gzip); owner explicitly authorized fix.
- Repair stable Preview fix/404-dev-home-size-20261022@b1b4a60dc384d9fc6a70b2c2c9665765c36aa564 passed canonical Quality Gate 39647088964 and Trusted Delivery 39647619354. PR #1195 promoted exact tree to dev@2dbc4c809ba9e4a939f526c2474e7c0a28e5df8b, dev Quality Gate 39647846426 SUCCESS, official Vercel dev deployment dpl_CRYJx8Z5SCVCMBqQwdStRXFGw4PZ READY. Main and Production untouched.

## Feature scope / delivery boundary
- Owner authorized implementation (but not its later dev/main/Production promotion). Task branch chatgpt/404-todo-diary-panel-20261022, stable target feature/404-todo-diary-panel-20261022 from exact repaired dev.
- v0.41.0 MINOR: reuse existing DayDetailPanel and DayViewSheet for Todo List and Diary on wide desktop, left/right with resize and month-grid/full-screen height modes; preserve existing inline Bottom behavior and narrow fallback. Preserve Diary double-tap opening, friend read-only/replies/diary entry placement, date navigation and existing Calendar snap corrections.
- Lazy DayLayoutMenu in owner/friend sheet/inline and panel headers; uses existing synchronized preference keys for position/height, with keyboard/Escape and outside-click behavior.
- Compact TodoCalendarGrid exposes a realignment callback, clips native horizontal scroll, and suppresses automatic Embla resize during panel motion. Full-screen workspace measurements are taken from the outer Home workspace to prevent breakpoint oscillation. Browser fixture tests real left/right compact month swipes including divider resizing.
- No backend/schema/Production changes. No weakening of fixed 381000 Home gzip gate.

## Verification so far / next
- Earlier isolated source sandbox (before its 30-minute expiry) passed local v0.41.0 build at 380882/381000 Home gzip with public Preview config, lint 0 errors, targeted Calendar/Todo/menu DOM 16/16, full DOM 661/661, actual Chromium left/right compact month swipe 2/2, and version check. Initial full unit 1202/1204 only because generated COMPONENT_INDEX was stale; index was regenerated and its two failed contracts passed 10/10.
- Those uncommitted sandbox files were lost when the session auto-expired; equivalent changes were reconstructed directly as Git blobs from the verified patch operations, along with version/index/tests and this checkpoint. Exact committed tree still requires remote CI verification. Do not treat old sandbox runs as acceptance evidence for a different SHA.
- Next: create coherent task branch commit requesting [verify:browser]; if focused + browser gate green, open PR and squash to stable Preview, verify canonical and trusted Vercel READY, give user immutable test URL, keep issue #404 OPEN. Do not promote this v0.41.0 feature to dev or main without separate explicit owner approval. Manual touch/device and editing-draft preservation remain acceptance risks.
