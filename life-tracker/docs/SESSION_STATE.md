# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #954 — Calendar per-day task preview limit.

## Authorization / boundary
- Owner authorized implementation with exactly 3, 5, 8, 10, 15, 20, Unlimited; Unlimited is backward-compatible default.
- Read `dev@a14c270309e1c80c04071cf3c74d57a6998c51ec` (v0.31.7), applicable AGENTS/docs and live issue #954. No prior PR for #954.
- Isolated task branch `chatgpt/954-calendar-task-limit-20261020` and stable Preview target `feature/calendar-task-limit-954-20261020`, both based on that exact dev SHA.
- Proposed initial feature Preview v0.32.0, after checking active branches/PRs for that version. No dev/main merge, Production change, provider/schema mutation or 1.0 release authorized.

## Implementation
- Preference in Calendar settings, validated values and owner-scoped `useSettings` persistence.
- Propagate viewer preference through owner/friend Calendar, slides, Month/Week grids and memoized DayCell.
- Cap owned and received shared previews per cell after existing completed-first ordering; holidays do not consume slots. Render `+N more tasks` for hidden previews, preserve full accessible task count and date activation. Unlimited renders all previews.
- Focused unit/DOM regressions for validation, all caps, default, completion-first, shared/holiday, memo updates, Month/Week/mobile zoom.

## Verification / next
- GitHub-connected edit environment has no local repository/network, so local npm/TypeScript/DOM execution and device checks have not been performed.
- Next: publish coherent task commit with `[verify:focused]`; inspect exact-SHA focused CI. If green, squash into stable Preview and verify canonical CI + trusted Vercel deployment. Do not promote without further owner approval.
