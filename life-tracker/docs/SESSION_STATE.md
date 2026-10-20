# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #859 Day View category gesture — mobile text selection / drag recovery.

## Baseline and scope
- Stable Preview `feature/dayview-category-gesture-859-20261020@cccd708a44c74f913fbacef2254ea64bdae83cc3` (v0.31.5) passed Chromium mouse/touch drag contract; owner reports on actual phone stationary hold opens Edit but drag does NOT start, and holding selects category text.
- Scoped task `chatgpt/859-mobile-native-selection-20261020`, candidate PATCH v0.31.6, not dev/main. No backend or Scratch mutations. User has not approved promotion.
- Development branch remains on issue #859 stable Preview lineage, not unrelated concurrent dev work.

## Root cause evidence and changes
- Category pill and label did not explicitly disable mobile text selection or WebKit long-press callouts (only touch-action:none on label), so native selection could steal the long-press pointer session.
- Motion touch session was previously started from the retained original pointerdown after a 500 ms timeout. Chromium emulation accepted this, but real browsers can cancel/select that pointer before the timer. On both mouse and touch, register Motion drag controls **synchronously on the original live pointerdown**, using 8 px distance threshold.
- Before hold completes, a touch move >= threshold first calls controls.cancel() (skipping onDragEnd, preventing unwanted persistence), then cancels the hold timer; pointer-up also cancels an unstarted touch session. After hold, actual drag-start cancels the hold listener and hides Edit. Preserve mouse drag, stationary-hold Edit, options keyboard path, normal tap-add, task drag and owner/read-only/selection restrictions.
- Scope native selection prevention to interactive category pill and label (CSS user-select and WebkitUserSelect: none, WebkitTouchCallout: none). Avoid globally disabling text selection or affecting inline inputs.
- DOM and real-browser regressions test immediate touch session arming, cancellation before hold, continued hold-to-drag, synthetic click suppression, and non-selectability of category text.
- Real physical Android/iOS acceptance remains essential because Chromium touch emulation previously passed while phone failed.

## Verification / next
- Initial task Quality Gate #39396455840: both browser shards SUCCESS, including live Motion touch drag, pre-hold swipe cancellation and nonselectable label. Focused job: 1926 tests passed, one DOM assertion failed only because Happy DOM doesn't implement WebKit-only CSS property `-webkit-touch-callout`; removed that browser-specific DOM expectation and kept actual browser coverage. No changed functional source.
- Commit repair with `[verify:focused]`, then squash to stable Preview, run full canonical CI and exact-SHA protected Vercel READY; seek physical phone manual acceptance. Keep issue OPEN. No dev/main/Production promotion.
