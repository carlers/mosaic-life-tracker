# Session checkpoint

Updated: 2026-10-11
Current task: issue #406 v0.14.4 shared recipient placement and date calendar regressions. User reported accepted share drags/reorder and category assignment failing or changing Day View to the next day; user also requested immediate calendar on Change Date for shared and native tasks. Baseline stable Preview feature/shared-tasks at e744bb0a7852a391c47aa94ac506cb28b5fe666d (v0.14.3). dev/main and Production untouched.

## Changes in task branch
- SharedTaskRows action sheet ownership is now lifted into stable DaySlideContent, so category relocation doesn't unmount an open sheet/retire its browser-history guard or interfere with Swiper. Shared action/date sheets lock Day View background swipe.
- TaskReorderRuntime preserves validated shared drop targets, instead of discarding them without a native drag session; pure placement planner handles before/after shared rows and maps native row/gap drops to the start of recipient's shared group. Serial account-scoped settings updates persist share order.
- Shared title/date owner authorization unchanged. All individual, bulk and shared Change Date flows use reusable TaskDateCalendar shown immediately with month navigation and a visible calendar grid; DatePickerSheet accepts a minimal date-target shape, so no private owner fields are needed.
- Added unit + DOM regression tests for move order, shared action survival across category changes, calendar immediate display and date confirmation. New Preview patch version 0.14.4, frontend only; reusable default documented in docs/TASK_DATE_INTERACTION.md.

## Next action
- Verify TypeScript, contracts, lint, focused/DOM, build/PWA/size. Repair failures; commit exact tested task tree on chatgpt/** with [verify:focused].
- On focused green, PR/squash into feature/shared-tasks; verify canonical gate and exact-SHA Vercel Preview. Update issue #406 with evidence; no dev/main promotion without explicit approval. Real Android/iOS/PWA gesture + date sheet acceptance is a distinct manual check.
