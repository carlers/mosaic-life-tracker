# Daily Review — issue #1794

## Owner feedback
Restore horizontal swiping between Plan, Execution and Reflection; make Review panels and controls honor Mosaic's responsive wallpaper glass material, circular task completion treatment and colored category chips.

## Implementation and invariants
- Focus mode keeps all three full-width stages mounted in one native horizontal scroll-snap strip. Finger and precision-trackpad scrolling remain browser-owned; stage nav and Overview/pinch retain direct focus. Each stage owns vertical scrolling. Inactive stages are inert/aria-hidden for keyboard and assistive technology, not physically removed from the scroll strip.
- Overview retains three columns; focus/overview changes realign the strip after layout. Gestures must not hijack inputs/Diary editing or route swipes.
- Canonical task completion uses accessible role=checkbox buttons, category-colored circular filled checkmarks, and the shared owner toggleTaskCompletion hook; no duplicate records.
- Category badges reuse Mosaic's pill and label-color conventions, with a colored dot. Review surfaces opt into existing mosaic-material-panel/control classes; glass activates only with opted-in wallpaper and supportive browser, with opaque fallback. The Diary text editor stays opaque for readability.
- No Appwrite schema, Function, authentication or release environment changes.

## Test and release boundaries
- Focused DailyReviewView component tests: task toggling and independent Diary record edits, overview/focus behavior, native scroll stage tracking, and pinch.
- Canonical Quality Gate on exact stable Preview SHA and official Vercel Preview READY must pass before handoff.
- Manual device acceptance: iOS/Android horizontal finger-following, vertical scroll in long stage, trackpad momentum, two-finger pinch/OS zoom accessibility, long category labels, wallpaper-on/off glass, Light/Dark/Black, checkbox category colors, two-entry Diary edits.
- Owner approval required for promotion to dev or main. Historical immutable plan/execution ledger remains outside this refinement.

## v0.131.2 — focused Plan ↔ Execution transfer
- The daily task's **scheduled date** owns its stage: incomplete tasks appear in Plan; completed tasks appear in Execution, even when their completion timestamp is another day. This makes the user's same-day task reversible through the canonical checkbox and fixes the disappearing-task case.
- Tasks completed on the inspected day but *scheduled for another date* are listed separately in Execution with their actual scheduled date. Unchecking one does not manufacture a plan for the inspected day: a persistent movement notice offers **View Plan day** to navigate to its real scheduled day and **Undo** to restore completion.
- A successful toggle shows an accessible, short-lived movement notice with direct Undo. The notice for an off-date uncheck remains until dismissed or acted on so the destination cannot disappear silently. In Focus, movement does not switch stages automatically.
- Destination task rows show restrained directional arrival motion (Plan → Execution, left to right; Execution → Plan, right to left), with motion entirely disabled when reduced motion is requested. No animation updates the stage scroller or creates a copy of the task.
- Task writes still use the canonical `toggleTaskCompletion` and existing RxDB owner account guards. No Appwrite migrations, new historical assertions, or changes to Diary/Reflection.
- Verify same-day completion, completion stamped on later day, rapid undo and repeated clicks, off-date completion/return destination, date switching, Overview/Focus gestures, accessibility and reduced-motion behavior, offline return and failure path.
- This does **not** complete the independent immutable plan/outcome/event ledger from #1794.

## v0.131.3 — remove redundant Reflection status action
- Remove the `Finish review` / `Reviewed` button from the Reflection stage: it previously only marked a date with a review timestamp without changing task, Diary or outcome behavior.
- The existing Reflection Diary selectors, inline editor, entry creation, privacy controls and Overview/Focus navigation remain unchanged.
- The legacy `daily_review_v1_*` day records remain preserved for compatibility; there is no migration or data deletion. The existing `finishReview` hook remains available to legacy consumers, but the Daily Review UI no longer calls it.
- Scope is frontend-only. Test absence of the removed action and continued Diary creation, then require focused CI, canonical Preview CI and exact-source READY deployment. `dev`, `main`, backend and Production remain untouched.

## v0.136.0 — integration with current dev (issue #1794)
- User-approved v0.131.3 Review behavior has been replayed onto the current v0.133.0 dev baseline as a newly versioned integration candidate. The original accepted Preview branch is preserved.
- Preserve dev Calendar category/title filtering and Diary create/edit semantics. Use the previously accepted lazy Diary workspace to keep Diary-only subscription/editor logic out of the Home startup closure, alongside the independent lazy Daily Review workspace.
- Review date header navigates by days. All other Home date headers keep month navigation. Calendar-only filtering remains scoped to Calendar.
- Keep the accepted reversible Plan ↔ Execution UX and Reflection without the redundant Reviewed button; no Appwrite schema or Function changes.
- Integration CI must verify both original Daily Review regression tests and the current dev Calendar filtering and Diary tests. Promotion requires fresh exact-SHA full canonical success and READY Preview readback before a guarded dev PR merge.

## v0.136.0 Home startup budget repair
- The direct dev integration exceeded the unmodified Home gzip startup gate by 213 bytes. A first scoped date-navigation/CSS-only optimization did not change the measured closure materially, confirming the transition stylesheet was deferred already.
- Keep the existing dev Diary editor functionality while moving its owner subscription, selected-entry and editor-sheet wiring to the previously accepted lazy `DiaryOwnerWorkspace`, which renders only when the user selects Diary.
- The original dev `OwnerDiaryEditorAdapter` source remains in the repository; no data migration or backend writes are made. Preserve the Calendar filter state and all Review behavior. The unmodified build-size thresholds, full DOM/browser tests and official Preview checks must pass before dev promotion.
