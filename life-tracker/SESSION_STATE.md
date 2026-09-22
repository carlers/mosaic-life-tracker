# Session state

Updated: 2026-09-22
Current task: Todo List hosted/device acceptance
Status: The Todo List regression repair is implemented on the task branch. The selected-day workspace receives the same already-loaded task/category data as the compact grid, the inline Day View/Swiper is width-bounded to prevent page-level horizontal overflow, the compact grid owns horizontal month swipes, and both Todo gesture regions are isolated from the outer friend/person carousel.
Roadmap pointer: Strategy B tombstone retention and its Appwrite rollout remain complete. Todo List is still the active feature-backlog item and remains unchecked in `PLAN.md` until the repaired build passes hosted real-device acceptance.
Checkpoint: GitHub verification is consolidated into the single `Verify` workflow. Its repository gate now includes project contracts, Vitest discovery, lint, the full Vitest suite, and production build; its dependent browser-contract job discovers and runs repository Playwright specs from `tests/e2e/`. The prior standalone Interaction Browser Contract workflow was removed. Verify #116 exposed a real Todo grid ARIA row-structure defect after the new production grid entered the browser harness; the defect was repaired by grouping gridcells under semantic rows and is awaiting the final rerun.
Next action: Require the final task-branch `Verify` run (both jobs) and Vercel deployment to be green, fast-forward that exact commit to `preview`, require the `preview` Verify run and Vercel deployment to be green, then run hosted phone acceptance.
Blockers: Automated touch Chromium verifies gesture ownership and page overflow, but Samsung/Android real-touch recognition and the authenticated task data display on the hosted app remain manual acceptance checks.

## Preview acceptance

- PREVIEW-1 — Vercel can build from `life-tracker/` using the canonical production build.
- PREVIEW-2 — Direct loads of Mosaic BrowserRouter routes resolve to `index.html` without rewriting emitted static assets.
- PREVIEW-3 — A dedicated `preview` branch carries verified commits selected for hosted review.
- PREVIEW-4 — The stable Vercel production hostname is the canonical phone-test origin and is registered once with Appwrite.
- PREVIEW-5 — Dynamic Vercel branch URLs are not assumed to have Appwrite access.
- PREVIEW-6 — No deployment secrets are committed; PostHog remains optional and no-op without config.

## Verification

- Todo task-data regression: DOM coverage verifies the Todo surface forwards its loaded task/category data into the shared inline Day View workspace.
- Todo horizontal-overflow regression: DOM coverage pins width containment; the browser contract retains the 320 CSS-px page-overflow assertion.
- Todo compact-grid gesture regression: DOM coverage verifies month-swipe dispatch, and the browser contract uses the production `TodoCalendarGrid` inside the outer person Swiper to require month change without friend change.
- Todo inline-day gesture regression: browser contract requires nested day change without friend change.
- Browser accessibility: the browser Axe gate discovered the Todo gridcell/row defect in Verify #116; semantic week rows now match the existing MonthView grid pattern.
- CI contract: one GitHub `Verify` workflow owns the repository gate and dependent Playwright browser contracts; all browser specs remain under `tests/e2e/`.
- Appwrite tombstone maintenance remains live and green on the existing `message-action` Function; the second Function slot remains free.
- Todo List Samsung/real-device acceptance remains pending and is the final product acceptance gate before checking the roadmap item.
