# Session checkpoint

Updated: 2026-10-11 UTC
Current task: Day View first-open latency follow-up after v0.17.7 Preview was reported unchanged.

## Verified basis
- `dev=80f1dd10b66b0e4965ce88ed4dcbfcaf575db777` (v0.17.6); stable Preview `perf/day-view-idle-warmup-20261011=a94acdf6cdcb1977b6c9f14ce6c075def9591871` (v0.17.7), full canonical CI/READY Vercel verified.
- User reported a persistent first-mount delay even after refresh. Idle module warmup alone does not address synchronous first-mount work.
- New task branch `chatgpt/day-view-first-paint-20261011` from the accepted CI/Preview tree, planned candidate v0.17.8 on the same stable Preview branch.

## Change
- Fix `BottomSheet.deferChildrenUntilPaint` to paint the lightweight portal before expensive children when first mounted already open (React's initial useDeferredValue cannot defer that mount).
- Delay child mount by two animation frames, cancel if closed before ready, preserve mounted children through close, and activate focus trap once controls exist.
- Limit Day View date-label formatting to the existing active ±3 day window; keep 181 Swiper geometry slides and rapid-swipe contract.
- Bound idle loader wait without entering the startup graph. Frontend only, no backend/cloud changes.

## Next action
- Run focused CI on the task commit, repair failures; squash-merge to stable Preview; complete the canonical full gate and exact Vercel READY verification.
- Compare cold first-open behavior and startup on real devices; no manual/device timing measurements have yet been collected.
- Do not promote to `dev` or `main` without separate user approval.
