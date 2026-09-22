# Session state

Updated: 2026-09-22
Current task: Todo List hosted/device acceptance
Status: Todo List now keeps horizontal gestures inside the Todo surface instead of leaking them to the outer friend/person carousel. Its selected-day area reuses the existing Day View workspace inline: category pills, task add/toggle/edit behavior, Task Action Sheet, and the existing memo/date/visibility/photo nested surfaces are shared rather than reimplemented.
Roadmap pointer: Strategy B tombstone retention and its Appwrite rollout remain complete. Todo List is the active feature-backlog item and remains unchecked in `PLAN.md` until hosted real-device acceptance is green.
Checkpoint: The implementation checkpoint passed canonical Verify #112, the nested-carousel Interaction Browser Contract #10, and a task-branch Vercel build. The browser contract directly checks that a nested Todo day swipe changes the inner day while the friend/person index stays fixed. This final checkpoint also makes Todo List source changes trigger that browser contract automatically.
Next action: Promote the exact final green checkpoint to `preview`, then perform hosted phone acceptance: Todo day swipes must change only the selected day, crossing a month boundary must update the Todo month, the inline task area must match Day View behavior, and task/nested action sheets must still behave correctly.
Blockers: Automated verification does not replace Samsung/Android real-touch recognition. Todo List completion is blocked only on that hosted manual interaction check.

## Preview acceptance

- PREVIEW-1 — Vercel can build from `life-tracker/` using the canonical production build.
- PREVIEW-2 — Direct loads of Mosaic BrowserRouter routes resolve to `index.html` without rewriting emitted static assets.
- PREVIEW-3 — A dedicated `preview` branch carries verified commits selected for hosted review.
- PREVIEW-4 — The stable Vercel production hostname is the canonical phone-test origin and is registered once with Appwrite.
- PREVIEW-5 — Dynamic Vercel branch URLs are not assumed to have Appwrite access.
- PREVIEW-6 — No deployment secrets are committed; PostHog remains optional and no-op without config.

## Verification

- Appwrite tombstone maintenance: live and green on the existing `message-action` Function; the second Function slot remains free.
- Todo List DOM regressions: cover the color-only month grid, inline Day View reuse, parent-Swiper isolation, month navigation, and cross-month inline day navigation.
- Day View regression coverage: inline mode preserves the shared task-action surface and configures its Swiper for nested gesture ownership.
- Interaction Browser Contract #10: green for nested Todo swipe ownership in a mobile/touch Chromium harness; calendar/outside-carousel contracts remain green in the same suite.
- Canonical Verify #112: green for the implementation checkpoint.
- Task-branch Vercel deployment for the implementation checkpoint: READY.
- Todo List Samsung/real-device acceptance: pending; this remains the final acceptance gate before checking the roadmap item.
