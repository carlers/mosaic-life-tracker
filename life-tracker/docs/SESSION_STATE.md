# Session checkpoint

Updated: 2026-10-20 UTC
Current task: integrate user-approved #692 Calendar pinch / smooth animation into current dev while preserving #954.

## Authorization and exact sources
- Owner accepted live pinch behavior and 240-ms animation Preview, then explicitly requested merge to dev; **no main/Production approval**.
- Latest dev integration baseline `c8310550c81e140c98c8dc1003880fa2afe49554` (v0.32.0, accepted #954 3/5/8/10/15/20/unlimited Calendar task-preview limit).
- #692 owner-accepted source `feature/calendar-pinch-692-20261020@2ffb4c74b32d6cab68b1faebe190236fd962f3a0` (v0.33.1), full canonical Quality Gate #39412126255 SUCCESS, trusted Preview Delivery #39412350130 SUCCESS, matching Vercel READY.
- Source branches diverged from `a14c270`; a direct source-PR merge would not reproduce both accepted feature trees. Prepare new integrated feature Preview `feature/692-pinch-954-integration-20261020` from current dev, task branch `chatgpt/692-pinch-954-integration-20261020` and **unique v0.33.2** for materially different combined tree.

## Integration scope
- Preserve every #954 owner/friend Calendar task-preview limit setting/prop and DayCell/MonthView/WeekView changes and associated existing tests.
- Port #692 disabled-by-default `calendarPinchZoom` preference, owner/friend synced day-count changes and active narrow viewport recognizer, 7/4/3 gestures, 240ms pinch-centered morph respecting effective reduced-motion, scroll/sticky weekday and snap guards, and tests.
- Combined CalendarBody and CalendarCarousel now propagate both `taskPreviewLimit` and pinch-zoom options. No backend, auth, schema or other branch mutations.

## Gates/next
- This task commit requests focused CI; **not yet verified**. If green, squash task PR into integrated stable Preview and require exact merged-SHA canonical CI and trusted Vercel READY. Confirm concurrent `dev` SHA unchanged and promotion PR preflight/source/deployment, then **merge to dev** under explicit user approval. No promotion of old 2ffb tree, no blind commit/cherry-pick or source overwrite, no main/Production.
- User physically accepted the original #692 zoom and Preview animation. Combined tree has no separate device acceptance; automated gates plus user-approved scope required, and report any manual checks still outstanding.

## Integrated Preview repair
- First integrated stable Preview `caee6a71` canonical build failed because CalendarCarousel used the #954 `CalendarTaskPreviewLimit` type but its import was not included. React/DOM and static checks were green. Repair only that import and rerun focused + exact stable canonical before promotion; do not reduce build/TypeScript gates.
