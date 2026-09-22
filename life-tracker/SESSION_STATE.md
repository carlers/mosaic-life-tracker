# Session state

Updated: 2026-09-23
Current task: Todo/Day View polish, destructive data controls, bottom-nav inset, and responsive orientation
Status: Implementation is complete on the task branch. Todo calendar chrome is transparent with tighter Day View spacing; the global bottom-nav inset no longer leaves the extra dark strip; Account logout lives inside normal scroll flow; owner Day View exposes memo text and multi-tap shortcuts; Memo has read/edit modes; Day View date header delegates sheet drag; phone full sheets expose backdrop while tablet full sheets use full height; and Settings has a distinct Delete All User Data flow.
Roadmap pointer: Todo List remains unchecked in `PLAN.md` until this UI-polish batch passes hosted real-device acceptance.
Checkpoint: Spec-first Verify #135 produced behavioral red evidence across the new Todo, sheet-height, Day View drag-handle, memo/gesture, layout, orientation, and destructive-data contracts. Verify #136 turned all 525 Vitest assertions green but exposed a build-size regression caused by eagerly importing destructive-data dependencies. The delete path is now lazy-loaded; Verify #137 is green with 525/525 Vitest, 15/15 Playwright, PWA policy, and build-size budgets. A final browser-acceptance checkpoint now adds computed Todo background, real DaySlide multi-tap/memo behavior, and responsive BottomSheet geometry/backdrop dismissal.
Next action: Require the final task-branch Verify and Vercel deployment green, fast-forward that exact commit to `preview`, require preview Verify/Vercel green, then perform phone/tablet acceptance.
Blockers: Automated browser checks cannot replace real Samsung/iPad touch feel, orientation behavior in installed-PWA contexts, or intentional live execution of the destructive Delete All User Data action.

## Preview acceptance

- PREVIEW-1 — Vercel can build from `life-tracker/` using the canonical production build.
- PREVIEW-2 — Direct loads of Mosaic BrowserRouter routes resolve to `index.html` without rewriting emitted static assets.
- PREVIEW-3 — A dedicated `preview` branch carries verified commits selected for hosted review.
- PREVIEW-4 — The stable Vercel production hostname is the canonical phone-test origin and is registered once with Appwrite.
- PREVIEW-5 — Dynamic Vercel branch URLs are not assumed to have Appwrite access.
- PREVIEW-6 — No deployment secrets are committed; PostHog remains optional and no-op without config.

## Verification

- TDD behavioral red: Verify #135 failed the new pre-implementation contracts for Todo visual spacing, responsive full-sheet height, date-header drag ownership, memo rendering/editing, task multi-tap shortcuts, global nav inset, Account logout flow, responsive orientation, and Delete All User Data.
- Destructive-data unit coverage requires local+remote tombstones across synced user-owned rows, profile hiding/tombstoning, and referenced image cleanup; the UI confirmation explicitly distinguishes this from deleting the Appwrite login account.
- Owner Day View DOM coverage requires memo content inline, single/double/triple tap dispatch, read-first memo behavior, edit controls, and the private-only toggle.
- BottomSheet DOM/browser coverage requires backdrop dismissal plus phone/tablet responsive full-sheet geometry; Day View DOM coverage binds the date/navigation row to the shared drag-handle contract.
- Todo/browser coverage retains carousel/day selection/overflow/scroll ownership and adds computed transparent calendar chrome.
- Responsive orientation unit coverage requires tablet unlock and best-effort phone portrait lock; the manifest no longer globally forces portrait.
- Verify #137: 76 Vitest files / 525 tests green; 15 Playwright contracts green; production build, PWA policy, and build-size budgets green after lazy-loading destructive-data dependencies.
- Manual acceptance remains required for real phone/tablet gestures, installed-PWA orientation, and the destructive live-data path.
