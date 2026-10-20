# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #692 — opt-in two-finger Calendar zoom.

## Scope
- Implementation approved, not dev/main promotion. Source `dev@a14c270309e1c80c04071cf3c74d57a6998c51ec` (v0.31.7); task `chatgpt/692-calendar-pinch-20261020`, candidate v0.32.0.
- Preserve shipped 7/4/3 Calendar lanes. Add disabled-by-default, synced `calendarPinchZoom` preference; qualified two-finger spread/pinch changes one visible-day step and persists through existing `calendarZoomDays`. Applies only to narrow active month/week Calendar including viewer-owned friend views.
- Gesture handlers intercept browser multi-touch only inside opted-in active grid, preserve one-finger scrolling and browser zoom elsewhere. No backend migrations, provider or Production changes.

## Verification / next
- Task implementation committed with `[verify:focused]`; focused CI, canonical gate, Vercel READY and physical iOS/Android are pending and must not be claimed.
- After focused green, squash task into stable Preview and verify canonical, size/PWA, deployment. Physical iOS Safari/PWA and Android Chrome pinch/browser zoom, navigation and dense-calendar scrolling remain a manual gate. No automatic dev/main merge.
