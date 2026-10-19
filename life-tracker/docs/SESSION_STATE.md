# Session checkpoint

Updated: 2026-10-20 UTC
Current task: Implement optional sticky weekday headers in Calendar View (issue #952).

## Boundary
- Planned task branch: `chatgpt/sticky-weekday-header-952-20261020`, based on `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1`; Production `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` not modified.
- User explicitly authorized implementation, not promotion or Production release. Previous post-1.0 scheduling is superseded only for working on an isolated Preview.
- Frontend-only existing synced-settings change, no schema/Function migration. Preview version candidate 0.31.0 (other active features use 0.30.0).

## Changes
- Synced `stickyCalendarWeekdayHeader` preference, off by default, surfaced under Preferences → Calendar.
- Viewer-controlled setting propagated to owner and friend month/week grids.
- Pin weekday row to vertical slide scroller; for narrow zoom, keep it outside nested horizontal overflow and track native horizontal scroll imperatively without React scroll-frame updates.
- Add Preferences toggle regression and Calendar semantics/zoom synchronization coverage.

## Verification
- At time of this task commit: implementation prepared through GitHub connector; local tests not executed because this environment has no Mosaic checkout.
- Focused Actions, stable Preview canonical gate, provider deployment, and real-device interaction acceptance remain pending. Do not label them green without exact run evidence.

## Next action
- Trigger focused verification on the complete task commit ([verify:focused]), diagnose/redress any failures; then squash accepted code into distinct stable Preview candidate, run canonical CI and trusted Preview delivery. Do not promote to dev/main without explicit approval.
