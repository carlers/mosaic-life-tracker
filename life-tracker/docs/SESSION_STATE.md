# Session checkpoint

Updated: 2026-10-21 UTC
Current task: issue #404 split Day View panel reconciliation and adjustable left/right panel Preview.

## Baseline and authority
- User authorized: reconcile prior #404 Preview with dev and provide a fresh Preview with side placement and resizable split. No dev/main promotion approval.
- Task base dev e1c90b387ecfb4e29d64c88b6557703dd23ca207 v0.39.0. Prior split Preview feature/split-day-panel-404-20261012@59b64a8e4630d740c1ba906c2797b6ef627b7a44 (v0.21.0), not incorporated in dev.
- New user-facing Preview candidate v0.40.0. Task branch chatgpt/404-split-layout-dev-20261021.
- Current dev Calendar pinch zoom, keyboard grid and H Home navigation, task previews, Timeline mode, cross-day drag, friend calendar state and all unrelated settings must remain intact.

## Implemented task scope
- Account-synced optional Home owner/friend Day View side panel; default retains bottom sheet. Account-synced side choice defaults right, can choose left; mobile/narrow new opens use bottom sheet.
- Calendar and panel remain interactive at sufficient Home frame width (1040 CSS px). When an existing panel's frame shrinks, keep content mounted in an overlaid inspector to avoid draft loss.
- Pointer-draggable and keyboard-operable separator moves border, 320–720px panel with 560px calendar reserve, device-local saved width; no global modal rewrite. Both Day Views use existing virtualized inline/panel renderer, modal children unchanged.
- Reconciled with current dev rather than overwriting current CalendarBody / DayViewSheet / FriendDayViewSheet. Added preference and sizing tests.

## Verification and next action
- Task commit requests [verify:focused]; inspect CI/TypeScript/lint/unit/DOM, repair any failures, then squash into stable feature Preview and verify canonical quality gate and trusted Vercel READY exact SHA before sharing updated link.
- Responsive layout, pointer drag, keyboard, browser Back, owner/friend privacy and real-device/zoom manual acceptance remain unperformed until evidence. No Appwrite schema or Function changes.
- Do not merge dev/main or modify Production without explicit permission.
