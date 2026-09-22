# Session state

Updated: 2026-09-22
Current task: Todo List hosted/device acceptance after spec-first TDD/test audit
Status: Todo List interaction repair is implemented: the compact calendar uses direct-manipulation Embla month swiping, day buttons remain tappable, the selected-day workspace uses the real Day View content with loaded Todo data, and the Todo surface owns one cohesive vertical scroll without a nested task scroller.
Roadmap pointer: Strategy B tombstone retention and its Appwrite rollout remain complete. Todo List remains the active feature-backlog item and stays unchecked in `PLAN.md` until hosted real-device acceptance is green.
Checkpoint: The Todo repair was driven by spec-first browser acceptance tests committed before implementation. Their initial run produced behavioral-red evidence for smooth calendar movement, nested scrolling, and narrow-width containment. The implementation now passes the focused interaction assertions in the latest completed browser attempt; the final consolidated Verify run for this checkpoint remains the gate before preview promotion. A repository-wide test audit is recorded in `docs/TEST_AUDIT_2026-09-22.md`, and `docs/TEST_WORKFLOW.md` now requires spec-first TDD when practical plus a non-mocked integration/browser layer for cross-component UI contracts.
Next action: Require the current single `Verify` workflow (repository gate + browser-contract job) to pass, confirm the task deployment, fast-forward that exact checkpoint to `preview`, confirm preview Verify/Vercel, then perform Samsung/Android Todo acceptance.
Blockers: Automated Chromium can verify direct manipulation, tapping, scroll ownership, and overflow contracts, but real Samsung/Android touch feel and authenticated hosted task data remain the final manual product acceptance.

## Preview acceptance

- PREVIEW-1 — Vercel can build from `life-tracker/` using the canonical production build.
- PREVIEW-2 — Direct loads of Mosaic BrowserRouter routes resolve to `index.html` without rewriting emitted static assets.
- PREVIEW-3 — A dedicated `preview` branch carries verified commits selected for hosted review.
- PREVIEW-4 — The stable Vercel production hostname is the canonical phone-test origin and is registered once with Appwrite.
- PREVIEW-5 — Dynamic Vercel branch URLs are not assumed to have Appwrite access.
- PREVIEW-6 — No deployment secrets are committed; PostHog remains optional and no-op without config.

## Verification

- TDD red evidence: the pre-implementation browser run failed the spec assertions for Todo calendar follow-finger behavior, cohesive vertical scrolling, and horizontal containment.
- Todo calendar direct manipulation: production `TodoCalendarGrid` is exercised inside the outer person Swiper; browser acceptance requires follow-finger movement, adjacent-month snap, and no friend change.
- Todo day activation: browser acceptance taps a real gridcell and requires selected-date change without month/friend drift.
- Todo selected-day integration: a DOM integration test crosses the real `TodoListView -> DayViewSheet -> DaySlide` boundary and requires loaded category/task content plus page-scroll mode.
- Todo scroll/overflow ownership: browser acceptance requires no nested vertical task scroller and <=1 CSS px page overflow at 320 CSS px.
- CI contract: `.github/workflows/verify.yml` is the only repository workflow file on the working branch; its read-only default gate runs Vitest/build then a dependent Playwright browser-contract job. A task-branch-only hygiene job has narrowly scoped write permissions for the explicitly authorized one-time stale branch/workflow-history purge.
- Test audit: no snapshot-test pattern was found; the main identified weakness was UI mock-boundary blindness, now addressed by the integration-layer rule and Todo integration test.
- Appwrite tombstone maintenance remains live and green on the existing `message-action` Function; the second Function slot remains free.
- Todo List Samsung/real-device acceptance remains pending and is the final product gate before checking the roadmap item.
