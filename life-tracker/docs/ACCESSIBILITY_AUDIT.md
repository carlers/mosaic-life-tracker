# Phase 4 WCAG AA review

Updated: 2026-09-21

This document records the Phase 4 accessibility review of Mosaic's current shipped
interfaces. It is a review and remediation record, not a claim of WCAG certification.
The roadmap keeps this item open until the browser/manual protocol below is completed and
recorded.

Visual-preservation constraint (2026-09-21): future accessibility remediation must preserve
Mosaic's existing palette and visual treatment unless the user explicitly approves a visual
change. Semantic, keyboard, focus, naming, and announcement fixes can proceed without
restyling; a visual compliance conflict is reported for product decision rather than silently
changing colors or appearance.

## Scope

This pass covered the current auth, account/settings, home/task/day, friend, explore, and
messaging interfaces plus shared bottom-sheet/form primitives. The following roadmap items
remain intentionally separate and were not folded into this batch:

- calendar-grid semantics;
- keyboard day navigation in `DayViewSheet` (A11Y-33).

## Source-level findings remediated

- **Keyboard and semantics:** conversation rows now use native buttons; the category add
  affordance uses a native button; task/search/message interactions retain or gain visible
  keyboard focus.
- **Names and relationships:** password, username, description, date, and memo controls
  gained associated labels or persistent accessible names where placeholders had been
  carrying the label visually.
- **Error/status exposure:** auth errors are alerts; selected loading and transient-feedback
  surfaces expose polite status announcements rather than visual-only state.
- **Text contrast:** gray-500/gray-600 normal text on Mosaic's dark surfaces was lifted to
  gray-400 on the audited shipped surfaces. Bright emerald actions use dark foregrounds;
  destructive filled actions use a darker red treatment with white foreground.
- **Data-driven contrast:** category/task colors now use measured luminance helpers.
  Completed task text/check glyphs choose black or white against the stored category color;
  the predefined `#8338EC` category label uses an accessibility-only lighter violet on the
  black pill while preserving the stored category color.
- **Target sizing:** the interactive task-completion target is at least 24 CSS pixels.
- **Regression coverage:** semantic-control regressions are pinned in
  `ConversationRow.test.tsx` and `CategorySection.test.tsx`; all predefined category
  colors are checked against the 4.5:1 normal-text threshold in `colors.test.ts`.

The shared `BottomSheet` focus trap, dialog naming, focus restoration, stacked-sheet
interaction suspension, and Escape behavior were already covered by existing implementation
and tests; this pass did not replace that architecture.

## Automated evidence

GitHub Actions run `35551590886` on commit
`2314c16a77e551b537d987c595e455bcef61e91c` passed the canonical `npm run verify` gate:

- project-contract check: passed;
- ESLint: passed;
- Vitest: 63/63 files, 476/476 tests passed;
- production build: passed;
- generated PWA policy: passed;
- build-size guard: passed;
- measured build: 859,713 B entry raw, 266,620 B entry gzip,
  1,850,674 B aggregate raw, 551,348 B aggregate gzip, and
  1,911,081 B unique precache.

The preceding run `35551491279` failed only because the newly added contrast test used an
incorrect constant name/shape (`CATEGORY_COLORS` instead of
`getAllAvailableColors()`). That was a test-authoring defect, not behavioral red evidence.

## Manual/browser evidence still required

Do not mark the Phase 4 WCAG AA roadmap item complete until these checks are recorded on a
representative mobile viewport and a desktop browser:

1. **Keyboard-only traversal:** traverse auth, bottom navigation, settings/account, explore,
   messages/chat, task/day sheets, confirmations, and nested sheets. Confirm logical focus
   order, visible focus, no keyboard traps, and correct focus restoration on close.
2. **Screen reader:** verify control names/roles/states and live announcements for auth
   errors, loading states, sync/offline feedback, message/task feedback, and nested sheets.
3. **Resize/reflow:** at 200% text zoom and approximately 320 CSS px width, verify no loss of
   content/functionality and no unintended two-dimensional page scrolling.
4. **Touch targets:** on a phone, verify task completion and other compact icon actions are
   reliably operable without adjacent-target collisions.
5. **Rendered contrast:** spot-check computed foreground/background pairs in the browser,
   especially dynamic category/task colors, emerald actions, destructive actions, muted
   helper text, and disabled states.
6. **Gestures/alternatives:** confirm swipe-driven interactions retain an equivalent
   non-gesture path where required.

After this protocol passes, the roadmap checkbox can be closed. Calendar-grid semantics and
A11Y-33 then proceed as their own Phase 4 batches.
