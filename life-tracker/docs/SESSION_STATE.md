# Session checkpoint

Updated: 2026-10-12 UTC
Current task: Eliminate Calendar Day View first-mount CPU blockage after unchanged v0.17.7/v0.17.8 user experience.

## Verified basis
- Stable Preview `perf/day-view-idle-warmup-20261011=05d61403d303775d00f4917bb329a365a4c6f5e3` (v0.17.8) with full canonical acceptance and READY Vercel; user reported persistent delay even after one minute of waiting.
- The original performance harness mounted the sheet *closed* before measuring open, hiding cold mount; first diagnostic wrongly rerendered the entire oversized harness on click. Corrected via a separate ColdDayViewProbe state owner and paired matched browser runs.
- Controlled Playwright Chromium dev-server comparison, heavy 50-task synthetic fixture: first-open longest main-thread task 235 ms (181 DOM slides) versus 82 ms (9 DOM slides); reopened 251 ms vs 136 ms; empty first-open 109 ms vs no recorded 50 ms+ task. Diagnostic, not mobile production timing. Runs: baseline 38156892853, virtual 38156899850. Both browser suites passed.
- Rapid swipe and existing date navigation browser contracts passed during the virtualization experiment. Task branch `chatgpt/day-view-root-cause-20261012` based on stable Preview, proposed user-testable v0.17.9. `dev` advanced independently; do not promote without approval.

## Change
- Preserve all 181 logical selected-date positions while using Swiper Virtual to render only nearby DOM slides in sheet mode, avoiding layout of 181 initially mounted elements. Keep full seven-day fast-swipe buffer, explicit virtual update on far date jumps, and original inline Todo renderer.
- Correct cold-mount performance harness and keep an opt-in @performance diagnostic outside canonical browser correctness suite.
- Add browser regression for bounded slide DOM and far date jump plus swipe; maintain existing accessibility/gesture behavior.
- Issue #640 records the CPU measurements and metric-specific build-size review. Production app assets were 2,412,056 raw / 745,792 gzip, precache 2,497,415 B while entry, initial and Home caps remained green; reviewed aggregate ceilings are 2,413,000 raw / 746,300 gzip / 2,498,300 precache. Full gate's only red job was the old aggregate budget; DOM, lint/unit and browser including far-date jump passed.
- Frontend-only. No Appwrite, Production, schema or service changes.

## Delivery evidence and repaired Preview parity
- Task full canonical run #38157480612 was SUCCESS and v0.17.9 merged into the stable Preview via PR #642 at `fdb36eae4d291be5f14c2abc71e6ba36cde3d9a4`.
- First Vercel Preview deployment `dpl_FwoVGXEqZsakh3oRtTNuJeRt4ZWx` failed production bundling, while GitHub task build passed: Vercel scratch/GIPHY features emitted appAssetsRawBytes 2,414,270 vs cap 2,413,000; appAssetsGzipBytes 746,786 vs cap 746,300; precacheUniqueBytes 2,499,629 vs cap 2,498,300. Initial/entry/Home caps passed with Home closure 362,877/362,900.
- Review #640 raises **only** those three aggregate caps again, using failing Vercel deployment as evidence and preserving pinned baseline and original entry, initial, Home limits; no production config/Appwrite changes.
- Repair task branch `chatgpt/day-view-preview-size-parity-20261012`, based on stable Preview. Remains v0.17.9 because internal repair, not a new user-testable implementation.

## Next action
- Verify new far-jump/browser regression and focused checks on the complete v0.17.9 task commit; repair if needed.
- Run production-build/size preflight on task branch if needed for near-limit budgets. Squash into stable Preview only after focused success, then run one full canonical gate and verify exact Vercel READY SHA.
- Manually compare cold opening, refresh, instant/one-minute tap, and rapid swipes on mobile; browser diagnostics do not certify device perceived latency.
- Never merge to dev or main without separate approval.


## #640 follow-up after v0.17.9 mobile rejection
- User confirms the v0.17.9 stable Preview still delays on first Calendar day-cell click even after a minute; reopened sheets are immediate. Previous CI/virtualization benchmark did not certify perceived latency.
- Added a full CalendarBody → DayCell → lazy DayViewSheet browser fixture, opt-in first-paint timeline and an ordering regression. Existing isolated synthetic button did not measure this path.
- Task change splits the DayViewSheet component into a lightweight shared BottomSheet host and delayed DayViewSheetInner. The shared two-frame deferral now covers the *whole* expensive hook/Swiper subtree, rather than only its already-constructed children. The original sheet controls (back/focus, close/reset, horizontal gestures, motion settling, select-to-dismiss, reorder/nested lock) are forwarded via a mounted child control ref. Inline Todo/Backlog rendering remains unchanged.
- Verification still needed: focused type/lint/DOM/browser, production size preflight and exact-SHA canonical stable Preview delivery. Manual mobile perceived-latency acceptance remains required; do not promote dev/main or close #640 before approval.
