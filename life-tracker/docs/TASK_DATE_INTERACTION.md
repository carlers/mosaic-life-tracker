# Task date interaction default

All **Change Date** flows for owned tasks, bulk selection, and shared tasks
must open an immediately visible month-calendar grid. Use
\`src/components/home/views/TaskDateCalendar.tsx\` as the default shared
date-selection primitive inside \`DatePickerSheet\` and \`BulkDatePickerSheet\`.
Do not require a second tap into a native \`<input type="date">\` to reveal the
calendar. Keep month navigation, Today, and jump-to-date available for long
date jumps; a dedicated confirmation action is required before persistence.

Date values remain local calendar strings (\`yyyy-MM-dd\`); never UTC-convert
a chosen date or shift it by timezone. When changing a received shared task,
the owner-granted date edit and revision check still apply, and a save is
disabled while in flight. A visible calendar is not edit authorization.

This is a reusable UI default, not a per-feature convention to be remembered
at each new date action.
