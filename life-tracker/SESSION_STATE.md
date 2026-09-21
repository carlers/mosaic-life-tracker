# Session state

Updated: 2026-09-21
Current task: Calendar gesture ownership isolation after native sheet Back work
Status: Calendar and friend carousel gesture ownership has been separated. Calendar horizontal swipes now remain inside the calendar region while friend carousel swipes remain available outside the calendar. No visual styling changes were made.
Roadmap pointer: Phase 3.7 remains complete. Phase 4 accessibility work remains pending after the current interaction fixes.
Checkpoint: The previous calendar gesture isolation attempt blocked Embla pointer handling. The corrected implementation preserves calendar swipe behavior while preventing the parent friend carousel from consuming the same horizontal gesture. Regression coverage was added to protect calendar-only swipes.
Next action: Verify the Preview build on device: swipe directly on calendar (calendar changes only), swipe outside calendar (friends change), then continue with the Phase 4 manual accessibility protocol.
Blockers: None known for gesture ownership. Device verification remains required.

## Preview acceptance

- PREVIEW-1 — Vercel can build from `life-tracker/` using the canonical production build.
- PREVIEW-2 — Direct loads of Mosaic BrowserRouter routes resolve to `index.html` without rewriting emitted static assets.
- PREVIEW-3 — A dedicated `preview` branch carries only an exact verified commit selected for hosted review.
- PREVIEW-4 — The stable Vercel production hostname is the canonical phone-test origin and is registered once with Appwrite.
- PREVIEW-5 — Dynamic Vercel branch URLs are not assumed to have Appwrite access.
- PREVIEW-6 — No deployment secrets are committed; PostHog remains optional and no-op without config.

## Working set

- `src/components/home/views/CalendarBody.tsx`
- `src/components/friend/FriendCalendarView.tsx`
- `src/components/home/PersonPane.tsx`
- calendar gesture regression tests
- `AGENTS.md`
- `docs/ACCESSIBILITY_AUDIT.md`
- `SESSION_STATE.md`

## Verification

- Calendar regression coverage added for gesture ownership so future parent-carousel changes cannot silently disable calendar swiping.
- Stable Preview moved to commit `45f27a4bdb5a35b91e25aa494a5ab774f4b3f5fd`.
- Manual device verification pending: calendar swipe must remain independent from friend swipe regions.
- Native bottom-sheet Back behavior remains a separate verified interaction batch.
