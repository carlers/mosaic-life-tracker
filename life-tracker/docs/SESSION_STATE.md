# Session checkpoint
Updated: 2026-10-22, Asia/Manila
Current task: Issue #404, left-panel month-swipe misalignment; next Preview v0.40.5.

## Branch, gate and approval
- Exact accepted v0.40.4 stable Preview: `feature/split-day-panel-dev-404-20261021@ea5a6ad583b0586288b01e288f59fc88a5c5226d` with canonical [Quality Gate 39627958057](https://github.com/carlers/mosaic-life-tracker/actions/runs/39627958057) SUCCESS and [trusted Preview 39628447154](https://github.com/carlers/mosaic-life-tracker/actions/runs/39628447154) SUCCESS; immutable URL `https://mosaic-life-tracker-g5z9n630f-carls-projects-72516fde.vercel.app/home`.
- New task branch `chatgpt/404-left-month-swipe-20261022` from the accepted stable SHA. v0.40.5 is a PATCH refinement after user testing. No merge to `dev`, `main`, or Production authorized.
- Issue #404 remains open; old PR #1184 is already merged into stable Preview. Create a new PR against that stable branch for this fix.

## Exact browser reproduction and cause
- User: left-side panel remains aligned after opening or divider resizing, but calendar horizontal month swipes move the grid off-width again.
- Real Chromium with 1,600px desktop viewport and 412px left inspector, both short-grid and screen-height layouts: after opening on month slide 31 the focused slide was aligned, then dragging to slide 32 left the slide offset **+412px**; same for horizontal trackpad and next-month click. Right panel stayed aligned.
- Instrumented Embla after left-panel open: `containerRect.left=412` (offset of viewport against ancestor) while slide rectangles started at left=0 (against translated track). Embla consequently computed slide-32 scroll snap `-37604` instead of `-38016`. Existing manual re-snap after divider corrected track position without fixing Embla's *stored* snap coordinates.
- Minimal source fix: make the immediate `CalendarCarousel` wrapper position-relative, so viewport and slides share a local positioning origin; Embla then reported `containerRect.left=0`, slide-32 snap `-38016`, and correct horizontal swipes. No changes to panel animation logic, backend, gesture ownership or bundle budgets.

## Regression evidence and local verification
- Expanded `tests/e2e/split-panel-layout.spec.mjs`: real pointer drag to next/previous month **with the panel already open**, repeat after divider resize, then horizontal wheel next/previous. Existing open/close sampled-paint, full-width, panel-bottom and scrollLeft=0 assertions remain.
- **Red evidence:** accepted v0.40.4 source with added new test failed left/grid after actual swipe with Received **412**, Expected <2px. No fabricated failure.
- **Green evidence:** v0.40.5 source passed 8/8 repeated left/right × grid/screen browser cases with pointer drag; extended pointer+trackpad version passed 4/4.
- `npm run build` passed with publicly available CI Preview config (Home closure **380,888/381,000 gzip bytes**), `npm run version:check` and `git diff --check` PASS. `npm run lint` PASS (0 errors, 19 warnings); unit tests **1,204/1,204**; DOM tests **655/655**.
- Full exact-SHA GitHub focused/browser verification and canonical stable Preview acceptance / Vercel READY **not yet performed** for v0.40.5. Size headroom is very narrow with CI secrets; do not relax gates or claim readiness until remote build passes.
- Manual authenticated large-screen/mobile touch, owner/friend, pinch-zoom and reduced motion acceptance still pending.

## Next
Commit code, v0.40.5 version files, regression and this checkpoint together on task branch with `[verify:browser]`; inspect exact-head CI. If green, squash PR to existing stable Preview, run full canonical Quality Gate, and verify trusted exact-SHA READY Preview URL. Preserve existing stable link until acceptance and never promote to dev/main/Production without explicit approval.
