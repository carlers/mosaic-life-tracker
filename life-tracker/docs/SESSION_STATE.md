# Session checkpoint

Updated: 2026-10-11
Current task: issue #406 v0.14.5 fix cross-platform first-tap calendar opening. User reports the v0.14.4 automatic calendar opening failed on iOS/Android/desktop. Stable Preview feature/shared-tasks at 08e0132fdd5d3309de8561f4ca3fe9670858170e, dev/main unchanged.

## Root cause and working changes
- Previous shared Change Date closed the current BottomSheet, then used window.setTimeout(...,0) to mount a different DatePickerSheet. This detached gesture-driven user activation from the visible calendar and raced the shared BottomSheet's portal/history/focus cleanup, particularly in installed PWAs and Safari.
- App-owned month calendar now switches into the **same action sheet** directly on the click for owned, shared and bulk tasks. New TaskDateEditor composes existing TaskDateCalendar, tracks saving/error, preserves selected local date, and offers Back/Confirm. No native picker automation, timers or additional bottom-sheet history entries.
- Android Back in date mode restores the actions through BottomSheet onTransientDismiss. Shared date editing still needs owner's grant and server authorization. Native Jump-to-date remains optional.
- Added regression checks for single-tap visible calendar, exactly one dialog, ownership, bulk date saving and permission gates; docs/TASK_DATE_INTERACTION.md owns the default.

## Next action
- Run targeted UI tests, TypeScript, lint, full production build/PWA/size, and contracts; stamp 0.14.5.
- Commit exact tested tree with [verify:focused] from feature/shared-tasks, PR/squash only into stable Preview after focused green; verify full canonical quality gate and Vercel readiness.
- Real iOS Safari / Android installed-PWA acceptance cannot be claimed without testing on those devices; request a short final manual check if needed. Do not touch Production or dev/main without approval.
