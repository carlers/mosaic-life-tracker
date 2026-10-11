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
- Frontend-only. No Appwrite, Production, schema or service changes.

## Next action
- Verify new far-jump/browser regression and focused checks on the complete v0.17.9 task commit; repair if needed.
- Run production-build/size preflight on task branch if needed for near-limit budgets. Squash into stable Preview only after focused success, then run one full canonical gate and verify exact Vercel READY SHA.
- Manually compare cold opening, refresh, instant/one-minute tap, and rapid swipes on mobile; browser diagnostics do not certify device perceived latency.
- Never merge to dev or main without separate approval.
