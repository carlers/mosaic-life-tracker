# Session state

Updated: 2026-09-21
Current task: Phase 4 calendar semantics and accessibility automation
Status: Calendar month/week views now expose explicit grid, row, rowgroup, columnheader, and gridcell semantics while keeping the existing visual layout. Day cells expose full accessible date/task names, today's date via `aria-current="date"`, and disabled state when no day action exists. A11Y-33 is pinned at the actual `DayViewSheet` surface, and the interaction browser contract now includes calendar semantics plus a non-visual WCAG A/AA axe scan. No palette, typography, spacing, or visual treatment changed.
Roadmap pointer: Calendar-grid semantics and A11Y-33 are complete. The overall Phase 4 WCAG AA review remains open because screen-reader output, 200% zoom/reflow, physical touch-target judgment, rendered contrast, and physical Samsung/PWA acceptance still require manual evidence.
Checkpoint: The calendar keeps its existing CSS grid layout; semantic row wrappers use `contents` so no new visible box is introduced. Month and week headers expose full weekday names to assistive technology. Browser automation verifies the active calendar grid and current-date state, while axe is intentionally run with `color-contrast` disabled because visual-color remediation requires explicit product approval.
Next action: Complete the remaining manual Phase 4 protocol on the stable Preview, including Samsung/PWA hardware Back + real-touch calendar ownership, screen-reader checks, 200% zoom, touch-target checks, and rendered contrast inspection.
Blockers: No automated-gate blockers. Remaining acceptance is manual/device evidence.

## Preview acceptance

- PREVIEW-1 — Vercel can build from `life-tracker/` using the canonical production build.
- PREVIEW-2 — Direct loads of Mosaic BrowserRouter routes resolve to `index.html` without rewriting emitted static assets.
- PREVIEW-3 — A dedicated `preview` branch carries only an exact verified commit selected for hosted review.
- PREVIEW-4 — The stable Vercel production hostname is the canonical phone-test origin and is registered once with Appwrite.
- PREVIEW-5 — Dynamic Vercel branch URLs are not assumed to have Appwrite access.
- PREVIEW-6 — No deployment secrets are committed; PostHog remains optional and no-op without config.

## Working set

- `src/components/home/views/DayCell.tsx`
- `src/components/home/views/MonthView.tsx`
- `src/components/home/views/WeekView.tsx`
- `tests/components/CalendarSemantics.test.tsx`
- `tests/components/CalendarOverflow.test.tsx`
- `tests/components/DayViewSheetRegression.test.tsx`
- `tests/e2e/interaction-contract.spec.mjs`
- `.github/workflows/playwright.yml`
- `docs/ACCESSIBILITY_AUDIT.md`
- `docs/CHATGPT_GITHUB_CONNECTOR_WORKFLOW.md`
- `PLAN.md`
- `SESSION_STATE.md`

## Verification

- Interaction Browser Contract run `35620577757`: success for `feat: complete calendar grid accessibility semantics`; browser checks include nested Back/focus behavior, calendar/friend touch ownership, arrow-key parity, 320 CSS px reflow, active calendar grid semantics, and the non-visual WCAG A/AA axe scan.
- The first canonical Verify run for that implementation exposed one stale regression in `CalendarOverflow.test.tsx`: the test located the calendar body through the old `aria-hidden` weekday-header structure. Production behavior was not the failure.
- Follow-up commit `test: align calendar overflow regression with grid semantics` updated that regression to target the semantic `rowgroup`.
- Canonical GitHub Verify run `35620914559`: success after the regression update.
- Physical Samsung hardware Back, installed-PWA behavior, screen-reader output, physical touch targets, 200% zoom, and rendered contrast remain manual acceptance items.
