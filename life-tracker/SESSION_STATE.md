# Session state

Updated: 2026-09-23
Current task: Todo List cohesive-scroll/full-month/Day View header repair plus GitHub Verify latency reduction
Status: The repair is implemented on the active task branch. Todo now keeps one natural-height vertical content flow, prevents the compact calendar from flex-shrinking/clipping lower rows, moves Previous/date/Next into the horizontal Day View swiper surface, and explicitly hands vertical touch to the enclosing page scroller. GitHub Verify now starts repository and browser jobs in parallel, caches the pinned Chromium payload, and no longer carries the completed one-time hygiene job.
Roadmap pointer: Todo List remains the active feature-backlog item and stays unchecked in `PLAN.md` until the repaired hosted build passes real-device acceptance.
Checkpoint: Spec-first acceptance was committed before implementation. Verify #131 produced behavioral/contract red evidence for the clipped-calendar layout guard, date-header swipe ownership, vertical touch handoff, parallel browser verification, and removal of the stale hygiene job. The implementation is awaiting the consolidated green task-branch gate before preview promotion.
Next action: Require the task-branch Verify and Vercel deployment to be green, move that exact checkpoint to `preview`, require preview Verify/Vercel green, then repeat Samsung/Android Todo acceptance for one-page vertical scrolling, full-month visibility, date-header day swiping, and calendar/day gesture ownership.
Blockers: Automated Chromium covers layout bounds and synthetic touch contracts; real Samsung/Android touch feel and authenticated hosted task data remain manual product acceptance.

## Preview acceptance

- PREVIEW-1 — Vercel can build from `life-tracker/` using the canonical production build.
- PREVIEW-2 — Direct loads of Mosaic BrowserRouter routes resolve to `index.html` without rewriting emitted static assets.
- PREVIEW-3 — A dedicated `preview` branch carries verified commits selected for hosted review.
- PREVIEW-4 — The stable Vercel production hostname is the canonical phone-test origin and is registered once with Appwrite.
- PREVIEW-5 — Dynamic Vercel branch URLs are not assumed to have Appwrite access.
- PREVIEW-6 — No deployment secrets are committed; PostHog remains optional and no-op without config.

## Verification

- TDD red evidence: Verify #131 failed the new contracts before implementation: compact calendar lacked the non-shrinking layout guarantee; the date header lived outside the day swiper; inline Swiper did not explicitly hand vertical touch to page scrolling; browser verification serialized behind `verify`; and the completed hygiene job was still present.
- Todo full-month layout: DOM and browser acceptance require a six-week August 2026 grid to expose all 42 cells and keep August 31 inside the visible grid bounds while the enclosing Todo page is scrollable.
- Todo Day View header: DOM coverage requires Previous/date/Next to share one row inside the day Swiper and the sheet dialog to retain a full-date accessible label.
- Todo scroll ownership: inline Day View remains natural-height with no nested task scroller; Swiper touch configuration preserves horizontal day navigation while handing vertical-dominant gestures to the Todo page scroller.
- CI latency: repository and browser jobs run concurrently; the browser job reuses a version-keyed Playwright Chromium cache and installs the browser only on a cache miss.
- Existing full regression layers remain required: repository contracts, discovery, lint, all Vitest projects, production build/PWA/build-size checks, and all Playwright browser contracts.
- Todo List Samsung/real-device acceptance remains pending and is the final product gate before checking the roadmap item.
