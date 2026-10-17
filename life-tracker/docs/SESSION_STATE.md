# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 Calendar initial TaskBlock mount-density audit, diagnostic-only.

## Accepted boundary
- `dev@bfb0fff0c1c283f599f32db8c2a426416fa65e7b`, v0.29.8; approved Preview source `7429dab8b5a9f553e66cbb699d9b2beb1ac42cb7`, PR #949. #858 remains OPEN. No dev/main/Production/1.0 promotion approval.
- Todo inline A/B `chatgpt/858-interaction-containment-lab-20261018@3f5f8f34c1a0d681df7b356520b1d99d8e7a429f`, [#39070187878](https://github.com/carlers/mosaic-life-tracker/actions/runs/39070187878) passed. At 1000 same-day tasks slow-online Todo Home-ready p50 1679→1355ms with browser-only offscreen layout containment; eight matched 1000-task runs improved. NOT shipped.
- Calendar click-opened Day View A/B `chatgpt/858-calendar-day-click-lab-20261018@a68321a5ad3cb51fc68201eba56587ef15dc3b1c`, [#39071584460](https://github.com/carlers/mosaic-life-tracker/actions/runs/39071584460) passed (48 synthetic browser samples). 1000 cached tasks slow-online Day View click→DOM p50 527→416ms, two-frame proxy 818→716ms, offline 513→423 / 804→738ms; all 8/8 1000 click pairs faster and real deep-row CDP touch drag/cancel passed. No runtime changes; explicit 2-frame sheet-shell-before-content defer means click→Day View DOM != initial sheet paint.

## Current isolated TaskBlock experiment
- `chatgpt/858-calendar-taskblocks-lab-20261018` forked from accepted dev; only browser diagnostic, nondeployable workflow, and this checkpoint. No app source changes.
- Test initial Calendar home ready and DOM scaling vs ephemeral CSS `content-visibility:auto;contain-intrinsic-size:auto 22px` on synthetic text-only TaskBlocks in current-month Calendar. Both are same build, same UI-seeded IndexedDB fixtures, 25/250/1000 tasks, 4 interleaved repeats × offline/slow-online with all Appwrite requests held. Measure Home-ready, task-query→Home, first/last task DOM, long tasks and current slide scrollHeight and first card height for unsafe geometry. CSS is diagnostic ONLY; expected improvement/result **unknown**.
- Tests for real long title/photo/Diary/shared/keyboard/accessibility and actual phone not covered. If no performance gain or scroll height inaccurate, reject simple containment. Other optimization opportunities must remain evidence-driven.

## Next
- Verify exact workflow result, per-pair p50/p90 and geometry, and document outcome in #858. Treat all three as research-only; no accidental promotion. For any runtime candidate follow focused tests, stable Scratch Preview canonical CI/deploy READY and explicit owner manual/device acceptance before dev/main. #858 OPEN. Separate pre-1.0 #936 security and #914 backend migration gates remain open.
