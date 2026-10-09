# Session checkpoint

Updated: 2026-10-09
Current task: #409 — default-behavior architecture, v0.6.0
Status: implemented on stable Preview `refactor/ui-behavior-standardization` at `f0ea5e11`, full canonical browser-contract exposed a focus-return timing regression. Focus fix prepared on `chatgpt/ui-default-focus-fix`.
Next action: focused verification for focus timing; squash into stable Preview, rerun full canonical CI + Vercel READY, then request explicit dev promotion approval.
Blockers: none beyond failing browser gate currently being repaired.

## Implementation
- Shared BottomSheet owns drag, closing animation, modal layering, focus/background interaction locks, and history/Back.
- Bulk child sheets retain controlled mount lifetimes until exit completes.
- Protected routes generated from typed metadata; route swipe/back/chrome behavior and lazy preview/preload coverage derive from the same declarations.
- v0.6.0 is the user-testable Preview candidate; no backend, schema or theme redesign.

## Verification
- Focused CI `37887783354` passed; task merge PR #426 produced Preview `f0ea5e11`.
- Canonical run `37887889564` build/static/DOM passed and Vercel READY; one browser shard failed because the opener regained focus while `#root` was still inert after Back.
- Repair queues opener-focus return and runs it after visible modal exit/lock release. Extend real browser test to assert root remains inert during exit and is released before focus returns.
- Physical Android/iOS swipe, installed-PWA Back, and full theme acceptance are manual and have not been performed.
- Dev remains `b321373e`; main unchanged. Promotion not authorized.
