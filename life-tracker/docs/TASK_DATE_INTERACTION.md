# Task date interaction default

All **Change Date** flows for owned tasks, bulk selection, and shared tasks
must open an immediately visible month-calendar grid. Use
\`src/components/home/views/TaskDateCalendar.tsx\` as the default shared
date-selection primitive inside the same currently open action sheet, via
\`TaskDateEditor\`; \`DatePickerSheet\` and \`BulkDatePickerSheet\` also use
that calendar when opened directly.
Do not require a second tap into a native \`<input type="date">\` to reveal the
calendar. Keep month navigation, Today, and jump-to-date available for long
date jumps; a dedicated confirmation action is required before persistence.

Date values remain local calendar strings (\`yyyy-MM-dd\`); never UTC-convert
a chosen date or shift it by timezone. When changing a received shared task,
the owner-granted date edit and revision check still apply, and a save is
disabled while in flight. A visible calendar is not edit authorization.

This is a reusable UI default, not a per-feature convention to be remembered
at each new date action.

## Cross-platform one-tap calendar contract (v0.14.5)

For single, recipient shared and bulk task action sheets, tapping **Change
Date** switches the *existing* BottomSheet content directly to
\`TaskDateEditor\` and an already-rendered \`TaskDateCalendar\` with one React
state update. Never close an action sheet and reopen a second sheet through a
timeout: on iOS Safari/WebKit or Android standalone PWA this can lose the
portal/history/focus transition and leave the calendar invisible. Do not use
\`HTMLInputElement.showPicker()\` or synthesize taps to auto-open native
date controls: behavior and user-activation restrictions vary between Safari,
Chrome and installed PWAs. The app-owned grid is the default, works by ordinary
DOM rendering, and is immediately reachable with touch, mouse or keyboard.
\`Jump to date\` remains optional manual access to each platform's native picker.

Back in date mode returns to action choices without closing the parent sheet.
Only **Confirm Date** writes; failed saves retain the selected date with
visible error and a retry path. Existing owner grants still control collaborative
date changes.
