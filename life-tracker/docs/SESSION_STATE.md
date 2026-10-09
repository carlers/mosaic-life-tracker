# Session checkpoint

Updated: 2026-10-09
Current task: #409 — fix instant-closing sheets on Android Back/drag
Task branch: `chatgpt/sheet-exit-lifecycle-fix`, based on v0.6.0 accepted Preview `1d2ffc9e`.

## Root cause
- v0.6.0 initializes `childrenMounted` from `isOpen`, but never sets it true when an initially closed sheet opens. The subsequent Back/drag close therefore unmounts its portal immediately.
- Some feature-sheet owners also return null when task/message/friend state is cleared on close; Day View nested sheets and inline friend replies conditionally unmount.
- Fix shared presence arming, retain last opened entity to `onExitComplete`, keep affected owners mounted, and test both lifecycle and real-browser Back/drag dismissals.

## Delivery
- User-visible Preview repair: **v0.6.1**, with no theme/visual/backend/gesture-threshold changes.
- Focused CI, squash into stable `refactor/ui-behavior-standardization`, canonical CI, exact-SHA Vercel READY, issue update.
- Physical Android/PWA/iOS tests and theme visual review remain manual; `dev`/`main` unchanged without explicit approval.
