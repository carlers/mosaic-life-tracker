# Session checkpoint

Updated: 2026-10-21 UTC
Current task: issue #956 — Home Calendar keyboard month snap repair, v0.35.4 candidate; future shortcut ideas recorded for separate approval.

## Baseline and authorization
- User tested Stage 3 v0.35.3 and reported intermittent half-settled/full-width calendar slide after changing months with keyboard arrows. Other behavior works. User proposed F/S/E/A/C/M and Shift+Enter shortcuts as ideas, not yet implementation approval.
- Stable Preview `feature/dayview-keyboard-956-20261020@0d2d4a065230a8292321438b228c2f8ea1bda6b3` had full canonical CI 39452019710 SUCCESS and trusted Vercel READY 39452407081. `dev@0606ff3aebf565cd47f1fe9bc4e53cf64a1499a0` and `main@c938c825370f8270b46f19119b06a1f74d35842b` at task start. No dev/main promotion approval.
- Task branch `chatgpt/956-calendar-keyboard-snap-20261021` based on stable Preview. This is a subsequent user-testable PATCH v0.35.4.

## Diagnosis and repair
- In `useCalendarGridKeyboard`, focus on the newly active date called `Element.scrollIntoView()` during Embla's period slide animation. That API scrolls all ancestors, potentially moving the Embla horizontal viewport independently from its transform/snap. `CalendarZoomViewport` had an additional focus-time scrollIntoView and a duplicate arrow handler, which competed with the new calendar-grid controller in 3/4-day mode.
- Replace ancestor-wide scrollIntoView with scoped scroll only to the active slide vertical scroller and optional zoom weekday lane horizontal scroller; use focus({preventScroll:true}). Remove obsolete duplicate zoom arrow handler so one calendar-grid controller owns keyboard date moves.
- Add DOM regression guarding against unscoped implicit scrolling plus Chromium real-browser keyboard month-shift geometry regression using the existing CalendarBody/Embla browser probe, including consecutive PageDown/PageUp changes.
- First focused gate 39455372765 failed CalendarSemantics standalone MonthView 3-day zoom ArrowRight after removing the viewport's legacy arrow handler. Restore that handler solely when no CalendarBody keyboard owner is present, using scoped scrolling rather than the old ancestor-wide scrollIntoView; preserve standalone accessibility semantics.
- Repair task focused gate 39455904074 SUCCESS; PR #1118 squash-merged to stable Preview `11356c1c5bb2c650727772b6b34e43522eb9e08d` (v0.35.4 candidate). Canonical CI 39456127244 failed **only** browser contract (2/2) because the new calendar geometry test invoked `?calendarPath=1` without the existing probe's mandatory `perf=heavy` flag. All other canonical jobs passed; the requested browser regression did not run against a mounted fixture and must be repaired and reverified.
- Browser harness repair on `chatgpt/956-snap-browser-fixture-20261021` starts from the failed stable Preview SHA, adds the `perf=heavy` flag, and requests [verify:browser]. No new Preview version because v0.35.4 has not yet passed canonical acceptance or been offered to the user.
- Browser-focused verification 39456775986 mounted the probe after adding `perf=heavy` but failed because `CalendarPathColdProbe` did not pass the actual Embla `activeIndex` to `CalendarBody`, so keyboard focus could never see the incoming period. Repair the probe to mirror the production `PersonPane` wiring (`activeIndex`, `isZoomTransitioning`, `onZoomNavigate`); run browser-focused checks again before Preview squash.
- No backend/schema, visual or swipe changes; preserve Month/Week, 3/4/7-day zoom, pointer/touch behavior and input/modal keys.

## Shortcut follow-on (design only)
- Favor F to focus friend carousel (Left/Right browse, Enter select), S to focus Day View Select button, and optional E Explore / A Alerts / C Chats / M Me route shortcuts with discoverable help and a user preference.
- Do not assign Shift+Enter to period/friend navigation: it already opens task actions in Day View. PageUp/PageDown already switch calendar periods; avoid global key conflicts and native text/AT/navigation shortcuts.
- Separate implementation + tests required before any of these ideas become active.

## Delivery
- Commit scope and checkpoint with [verify:focused]. After focused green, squash PR into stable Preview; full canonical CI (including real browser contract) and trusted exact-SHA Vercel READY before user testing. No dev/main/Production modifications.
- User manual keyboard/device test and physical WebKit remain separate and unperformed by agent.
