# Session checkpoint

Updated: 2026-10-20 UTC
Current task: Preserve original Calendar background for optional sticky weekday headers (#952).

## Boundary
- Accepted first Preview: `feature/sticky-weekday-header-952-20261020@fe8ae38ecdc177a17ffeb3d3d411a6bdae1d5c40` (v0.31.0), PR #1043.
- Revision task branch: `chatgpt/sticky-weekday-bg-952-20261020` from that exact accepted Preview. Intended destination is the same stable Preview branch.
- Existing `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1`, `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged by this task. No dev/main promotion authorized.
- Revision Preview version candidate 0.31.1: new user-testable revision to previously accepted 0.31.0; maintain consistent package, lock and appVersion identities.

## Change
- `MonthView.tsx` and `WeekView.tsx`: replace only the sticky header's `bg-surface` with `bg-background` so the pinned row uses exactly the calendar's original base background in Dark, Light and Black.
- No changes to sticky positioning, horizontal zoom alignment, gesture ownership, display semantics, user preferences, schema or backend.
- No new CSS-class assertions: regression is visual/theme acceptance, while existing DOM/browser suites cover scrolling and alignment.

## Verification
- Prior accepted first Preview canonical Quality Gate #39292519381 SUCCESS and trusted Preview delivery #39292874170 READY.
- This revision still requires a new task focused Quality Gate and an exact-SHA full stable Preview canonical and trusted delivery.
- Manual iOS Safari/Android Chrome and connected Scratch login remain unverified.

## Next action
- Verify the scoped revision commit with `[verify:focused]`, squash through a PR into `feature/sticky-weekday-header-952-20261020`, check canonical gate and trusted delivery, then request manual visual acceptance; do not promote to dev or main without explicit approval.
