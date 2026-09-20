# Session state

Updated: 2026-09-20
Current task: Pre-Phase-4 UI regression batch + Phase 3.7 final verification
Status: implementation complete; runnable-workspace verification pending
Roadmap pointer: `PLAN.md` — do not advance to Phase 4 until this regression batch and the Phase 3.7 verification gate are green
Checkpoint: The 12 user-reported calendar/day-sheet/chat regressions are implemented with direct regression coverage on `chatgpt/phase-3-7-posthog`. `npm run verify` now owns the lint → test → build gate.
Next action: Run `npm run verify` locally. If green, run `npm run test:discovery`, complete the test-evidence review for PH-1…PH-9 and UIFIX-1…UIFIX-12, perform the remaining PostHog staging checks, then mark Phase 3.7 complete before starting Phase 4.
Blockers: This web environment has repository API access only and cannot execute the checkout's npm commands.

## Acceptance IDs

- UIFIX-1 — Calendar/Diary switcher remains visible in Diary and can return to Calendar.
- UIFIX-2 — FriendDayViewSheet supports adjacent-day horizontal swipe/navigation.
- UIFIX-3 — DayViewSheet task images fill available width with a responsive landscape aspect ratio.
- UIFIX-4 — Own-day category headers use black pills, colored category text, and an in-pill visibility icon.
- UIFIX-5 — DayViewSheet date is rendered in the draggable BottomSheet header.
- UIFIX-6 — Incoming messages are black with a gray outline; outgoing messages use the prior gray incoming treatment.
- UIFIX-7 — TaskActionSheet View Photo opens the image viewer with retained task context.
- UIFIX-8 — TaskActionSheet blurs the background and blocks underlying DayViewSheet interaction.
- UIFIX-9 — Nested task actions open their intended sibling surface without dropping task context.
- UIFIX-10 — DayViewSheet previous/next arrows actually change the selected date.
- UIFIX-11 — Calendar month/week content can scroll vertically when task density grows cell height.
- UIFIX-12 — Chat message scroller clips horizontal overflow above the composer.

## Working set

- `src/components/home/PersonPane.tsx`
- `src/components/home/views/CalendarHeader.tsx`
- `src/components/home/views/CalendarCarousel.tsx`
- `src/components/home/views/MonthView.tsx`
- `src/components/home/views/WeekView.tsx`
- `src/components/home/views/DayViewSheet.tsx`
- `src/components/home/views/useDayViewSwiper.ts`
- `src/components/home/views/CategorySection.tsx`
- `src/components/home/views/TaskItem.tsx`
- `src/components/home/views/TaskActionSheet.tsx`
- `src/components/friend/FriendDayViewSheet.tsx`
- `src/components/friend/FriendCalendarView.tsx`
- `src/components/messages/MessageBubble.tsx`
- `src/components/ui/BottomSheet.tsx`
- `src/pages/ChatPage.tsx`
- `tests/react/useDayViewSwiper.test.tsx`
- `tests/components/PersonPaneViewSwitcher.test.tsx`
- `tests/components/FriendDayViewSheet.test.tsx`
- `tests/components/TaskItemLayout.test.tsx`
- `tests/components/DayViewSheetRegression.test.tsx`
- `tests/components/CalendarOverflow.test.tsx`
- `tests/components/ChatPageLayout.test.tsx`
- existing component tests extended for CategorySection, MessageBubble, BottomSheet, and TaskActionSheet

## Completed substeps

- Kept Calendar/Diary chrome outside the active-view content branch so Diary never strands the user.
- Reused the own-day swiper controller for friend day sheets and passed the complete friend task collection so adjacent dates can render.
- Fixed arrow navigation by treating arrow moves as user navigation rather than suppressing their date-change callback.
- Moved the visible date into the BottomSheet drag header.
- Separated selected-task identity from TaskActionSheet open state; nested Memo, Visibility, Date, Photo Picker, confirmations, and Image Viewer retain task context.
- Fixed View Photo by assigning the active task to the viewer before opening it.
- Added BottomSheet suspended-interaction support for stacked sheets and blurred TaskActionSheet backdrops.
- Changed own-day category metadata to the friend-day black-pill pattern.
- Changed task images to full-width 16:9 responsive media.
- Swapped message bubble direction styling and clipped chat horizontal overflow.
- Made calendar carousel vertical overflow scrollable while preserving horizontally clipped Embla behavior and full-height rows that may grow with content.
- Added/extended regression tests covering UIFIX-1 through UIFIX-12.

## Verification

- Not executed in this environment.
- The last user-run suite before this UI batch was 489 passing / 1 failing; that sole PostHog test expectation was subsequently corrected.
- No green result is claimed yet for the current UI batch, lint, full test suite, build, discovery, evidence validation, bundle-size guard, or manual browser checks.
