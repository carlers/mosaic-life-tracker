# Session checkpoint

Updated: 2026-10-09
Current task: #409 — default-behavior architecture, v0.6.0
Status: v0.6.0 Preview `37e822a5` contains deferred-focus repair. Browser assertion measuring an ephemeral animation phase was too timing-sensitive; replacement test prepared on `chatgpt/ui-modal-lock-test`.
Next action: focused CI for the ordering-based browser assertion, then squash into stable Preview and rerun canonical CI + Vercel exact-SHA READY. Ask for dev promotion separately.
Blockers: none beyond failing browser gate currently being repaired.

## Implementation
- Shared BottomSheet owns drag, closing animation, modal layering, focus/background interaction locks, and history/Back.
- Bulk child sheets retain controlled mount lifetimes until exit completes.
- Protected routes generated from typed metadata; route swipe/back/chrome behavior and lazy preview/preload coverage derive from the same declarations.
- v0.6.0 is the user-testable Preview candidate; no backend, schema or theme redesign.

## Verification
- Focused CI `37887783354` passed; task merge PR #426 produced Preview `f0ea5e11`.
- Canonical run `37887889564` build/static/DOM passed and Vercel READY; one browser shard failed because the opener regained focus while `#root` was still inert after Back.
- Focus repair `384db95c` passed focused CI, squash Preview `37e822a5`; canonical `37888286428` caught an overly time-specific expectation (`root.inert === true` after awaiting browser Back), which raced the already-complete exit. The test now observes that inertness never ends **while the dialog still exists**, and separately asserts the original opener regains focus.
- Physical Android/iOS swipe, installed-PWA Back, and full theme acceptance are manual and have not been performed.
- Dev remains `b321373e`; main unchanged. Promotion not authorized.
