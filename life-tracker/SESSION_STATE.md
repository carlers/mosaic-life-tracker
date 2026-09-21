# Session state

Updated: 2026-09-21
Current task: Native mobile Back behavior for bottom sheets plus keyboard parity for calendar/day horizontal navigation
Status: The current behavior batch keeps Mosaic's rendered look unchanged. Shared `BottomSheet` now uses a same-URL browser-history guard so Android/Samsung Back dismisses the topmost open sheet before route history. Calendar month/week navigation and `DayViewSheet` day navigation now accept unmodified ArrowLeft/ArrowRight while preserving text-field cursor keys and nested-sheet priority. Accessibility guidance now explicitly forbids silent palette/look changes without user approval.
Roadmap pointer: Phase 3.7 remains complete. This batch implements the source-level A11Y-33 keyboard day-navigation behavior and extends it to calendar month/week navigation; roadmap closure still requires successful verification and the appropriate browser/device checks. The broader manual WCAG protocol remains next after this fix batch.
Checkpoint: Native-back handling is centralized in `src/components/ui/BottomSheet.tsx` so every shared sheet participates in one top-first stack. A single history guard covers the active sheet stack and is re-armed after one Back dismissal when an underlying sheet remains. Guard cleanup is deferred one tick to survive React StrictMode's setup/cleanup probe and same-commit sheet handoffs. Keyboard swipe parity is centralized in `src/hooks/useHorizontalArrowNavigation.ts` and wired into `CalendarBody` and `DayViewSheet` without visual class/style changes.
Next action: Pass the canonical GitHub Verify gate, then move the deployment-only `preview` branch to the exact green application commit and manually verify on a Samsung/Android browser or installed PWA: nested Back closes one sheet at a time, final Back resumes normal app navigation, calendar arrows change month/week, day-sheet arrows change day, and arrows still move the caret inside editable fields.
Blockers: Device-level Android/Samsung Back semantics cannot be fully proven by happy-dom; they require hosted phone/PWA verification before this behavior is considered device-accepted.

## Preview acceptance

- PREVIEW-1 — Vercel can build from `life-tracker/` using the canonical production build.
- PREVIEW-2 — Direct loads of Mosaic BrowserRouter routes resolve to `index.html` without rewriting emitted static assets.
- PREVIEW-3 — A dedicated `preview` branch carries only an exact verified commit selected for hosted review.
- PREVIEW-4 — The stable Vercel production hostname is the canonical phone-test origin and is registered once with Appwrite.
- PREVIEW-5 — Dynamic Vercel branch URLs are not assumed to have Appwrite access.
- PREVIEW-6 — No deployment secrets are committed; PostHog remains optional and no-op without config.

## Working set

- `src/components/ui/BottomSheet.tsx`
- `src/hooks/useHorizontalArrowNavigation.ts`
- `src/components/home/views/DayViewSheet.tsx`
- `src/components/home/views/CalendarBody.tsx`
- `src/components/home/PersonPane.tsx`
- `tests/components/BottomSheet.test.tsx`
- `tests/hooks/useHorizontalArrowNavigation.test.tsx`
- `AGENTS.md`
- `docs/ACCESSIBILITY_AUDIT.md`
- `SESSION_STATE.md`

## Verification

- Regression coverage directly exercises top-first native-Back stack callbacks while preserving the route URL.
- Horizontal-arrow hook coverage exercises left/right navigation, editable-field exclusion, modified-key exclusion, and disabled ownership.
- Existing `DayViewSheetRegression.test.tsx`, `useDayViewSwiper.test.tsx`, and calendar overflow coverage remain in the canonical suite.
- Physical Samsung/Android Back behavior remains a manual hosted-preview check because the DOM test environment cannot reproduce the operating system/browser history gesture itself.
