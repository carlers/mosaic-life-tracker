# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #404 Preview refinement v0.40.1 — fix left-panel month scrolling, add panel motion and height preference.

## Source of truth and scope
- Stable accepted v0.40.0 Preview source `feature/split-day-panel-dev-404-20261021@37253f36f393a3872d7e3cf2d553ffea20ad92d0`, full canonical CI 39546329988 success, trusted Vercel READY deployment dpl_Jq85MCYFHpAQhzKB5218SRiWz5Rr. No dev/main promotion approval; dev remains `e1c90b387ecfb4e29d64c88b6557703dd23ca207`.
- User found left-panel month carousel clipping at partial horizontal snap and requested smooth panel open/close and account-synced height choice: match actual month-grid content (default) or full available Calendar workspace (screen height).
- Patch revision v0.40.1, task branch `chatgpt/404-side-panel-animation-height-20261021` to squash into existing stable feature Preview after focused checks.
- Preserve existing owner/friend behavior, responsive fallback, nested sheets, task editors/drafts, drag geometry, 320–720px local panel width persistence, keyboard accessibility, reduced-motion, 1040px eligibility, and older calendar zoom/Timeline/keyboard features.

## Implementation
- Expose `resnapAfterResize` from `useCalendarState`. The lazy side panel observes Embla viewport size changes and reinitializes + snaps to the same logical month after settled geometry, including when panel animates and when separator is resized.
- Keep panel mounted during 280ms width/opacity open/close transitions; narrow overlay transitions by opacity/translate. Avoid remount on date switch or reopen during close; use inert/aria-hidden while exiting. Respect reduced motion.
- Height setting `dayPanelHeight` ('grid' default | 'screen'), synced via useSettings for both owner/friend. Default grid height uses active [role=rowgroup] bottom relative to grid top instead of full slide min-height; screen uses the full available Calendar workspace, excluding surrounding app chrome.
- Bump package, lockfile, appVersion to v0.40.1 once for this user-testable refinement. Add preference and interaction regressions; no backend schema changes.

## Acceptance and remaining
- Verify focused CI on exact task SHA, then squash stable Preview and canonical CI/build-size/PWA/browser + trusted Vercel READY exact SHA. Do not raise budget ceilings.
- Manual browser acceptance still required on physical wide viewport: left/right open/close month alignment, resizing, screen vs grid panel height, reduced motion, owner/friend, editor preservation during resize/exit, Back/Escape and touch.
- Do not merge dev/main or change Production without explicit subsequent approval.
