# Session checkpoint
Updated: 2026-10-22 Asia/Manila
Current task: Issue #404 Todo List / Diary left-right panel expansion and on-Day-View layout controls; deliver isolated Preview v0.42.0.

## State / authorization
- Owner tested and accepted Calendar large-screen v0.40.5; issue #404 must stay OPEN while expanding Todo List and Diary. Owner authorized repair dev, then feature implementation/Preview, but NOT promotion of this v0.42.0 feature to dev/main/Production.
- Concurrent category-color editing #1185 promoted version v0.41.0; #404 feature version bumped to v0.42.0 to avoid collision.
- Latest owner-authorized hosting repair PR #1213 promoted source fix/404-dev-category-byte-20261022@c53d6b6bebdd0142a262c00476d35b46f6fce490 to dev@31be0286812ed52f86caaaa68541ae1e351aa671. Promotion Quality Gate 39705347609 SUCCESS and Vercel dpl_CfrmVLN56YsnZZH1Q2qWDkomqd92 READY. Home original 381000 gzip hard gate unchanged. Main/Production untouched.

## Feature and acceptance
- Task branch chatgpt/404-todo-diary-panel-20261022, PR #1202 → Preview feature/404-todo-diary-panel-v042-20261022 (created from current accepted dev). Feature reuses DayDetailPanel for compact Todo/Diary left/right resizable panel, both height modes, and existing inline Bottom and narrow fallback. Shared account-synced DayLayoutMenu exists in owner/friend Day View header, and compact Embla swipe/resize browser regression.
- Earlier task SHA 46abded72e8396d767236fbd981db3546ed19cb6 passed focused and both browser shards in Quality Gate 39703329481. The next merge task commit retains all v0.42.0 feature code and accepts latest dev HomePage.tsx search-close optimization through true two-parent merge, resolving protected PR conflict. Reverify exact new task SHA with [verify:browser] before Preview merge.
- After new task CI success: squash PR #1202 into protected isolated Preview branch; require full stable canonical CI and trusted Vercel READY at exact SHA. Check actual Home bundle size in provider, no budget relaxations. Provide registered Preview alias for user testing. Keep #404 OPEN; device/touch/editor-draft checks pending user acceptance.

## Popup clipping hardening before Preview
- A review identified DayLayoutMenu's absolutely positioned popup would be clipped by the existing overflow-hidden DayDetailPanel and BottomSheet ancestors. Corrected by rendering the menu into document.body using a fixed-position portal anchored and repositioned to its trigger on window scroll/resize. Outside-click guard now considers both trigger and portaled menu and installs while open. React keyboard capture still closes with Escape and restores trigger focus. The menu popup remains outside the clipped panel's DOM ancestry.
- Added targeted regression wrapping DayLayoutMenu in a clipped ancestor: portal visibility invariant, inside interaction and outside-click dismissal. Isolated exact source from previous commit + patch: menu DOM 4/4, eslint 0 errors, production build Home 380881/381000 gzip PASS. Browser CI and stable Preview canonical acceptance are still required at next task commit; do not call v0.42.0 READY until provider confirms.
