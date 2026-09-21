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
messaging interfaces plus shared bottom-sheet/form primitives.

Calendar-grid semantics and A11Y-33 are now implemented. Month/week calendars expose labelled
grid, row, rowgroup, columnheader, and gridcell structure; day buttons retain their existing
interaction and expose full date/task names plus current-date state. Unmodified
ArrowLeft/ArrowRight mirrors the existing horizontal navigation in `DayViewSheet` and the
calendar period controls, while editable fields retain their native cursor keys and nested
modal ownership takes priority.

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
- **Calendar semantics:** month/week calendars expose explicit labelled grid structure,
  full weekday column names, semantic rows/cells, full date/task names on day actions,
  `aria-current="date"` for today, and disabled state when no day action is available.
  The semantic wrappers preserve the existing visual grid via `display: contents`.
- **Regression coverage:** semantic-control regressions are pinned in
  `ConversationRow.test.tsx`, `CategorySection.test.tsx`, and
  `CalendarSemantics.test.tsx`; A11Y-33 is pinned at `DayViewSheet`; all predefined
  category colors are checked against the 4.5:1 normal-text threshold in `colors.test.ts`.

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

### Automated interaction evidence

Interaction Browser Contract run `35607368142` passed 6/6 Playwright checks in Chromium
with Samsung/Android-style mobile settings. The contract now covers:

- three nested bottom-sheet history layers closing top-first before route navigation;
- focus restoration to the sheet opener after the final Back dismissal;
- CDP touch-drag verification that calendar swipes change the calendar without advancing
  the friend/person carousel;
- reciprocal verification that a touch drag outside the calendar can still advance the
  friend/person carousel;
- ArrowLeft/ArrowRight calendar navigation while editable controls retain their native caret
  behavior; and
- no horizontal page overflow at a 320 CSS px viewport.

Canonical GitHub Verify run `35607725909` then passed on
`66b4373ce98bd61165469fdfc86c3013376a05ed`: project contracts passed, 66/66
Vitest files and 487/487 tests passed, and the TypeScript/Vite production build,
service-worker policy, and build-size budget all passed.

A later calendar-semantics browser batch extended that contract. Interaction Browser Contract
run `35620577757` passed with active calendar grid/header/cell/current-date assertions and a
WCAG A/AA axe scan. The axe scan deliberately excludes `color-contrast`: visual-color changes
remain product-controlled and rendered contrast is still reviewed manually. The actual
`DayViewSheet` regression suite now also pins ArrowLeft/ArrowRight day navigation.

Canonical Verify run `35620914559` passed after updating one stale overflow test that had
depended on the pre-semantics weekday-header DOM shape.

These checks reduce the manual protocol but do not replace physical Samsung/PWA Back,
screen-reader output, rendered contrast inspection, physical touch-target judgment, or
200% zoom review.

## Manual/browser evidence still required

Do not mark the Phase 4 WCAG AA roadmap item complete until these checks are recorded on a
representative mobile viewport and a desktop browser:

1. **Keyboard-only traversal:** traverse auth, bottom navigation, settings/account, explore,
   messages/chat, task/day sheets, confirmations, and nested sheets. Confirm logical focus
   order, visible focus, no keyboard traps, and correct focus restoration on close.
2. **Screen reader:** verify control names/roles/states and live announcements for auth
   errors, loading states, sync/offline feedback, message/task feedback, and nested sheets.
3. **Resize/reflow:** the browser contract already verifies no horizontal page overflow at
   approximately 320 CSS px. Manually verify 200% text zoom for loss of content/functionality
   and unintended two-dimensional scrolling.
4. **Touch targets:** on a phone, verify task completion and other compact icon actions are
   reliably operable without adjacent-target collisions.
5. **Rendered contrast:** spot-check computed foreground/background pairs in the browser,
   especially dynamic category/task colors, emerald actions, destructive actions, muted
   helper text, and disabled states.
6. **Gestures/alternatives:** automated browser coverage verifies calendar-vs-friend swipe
   ownership and keyboard alternatives. On the physical Samsung/PWA target, confirm hardware
   Back and real-finger calendar ownership still match the automated browser contract.

After this protocol passes, the overall Phase 4 WCAG AA roadmap checkbox can be closed.
Calendar-grid semantics and A11Y-33 are already complete.
