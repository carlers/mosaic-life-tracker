# Appearance and theme implementation

Mosaic supports **System**, **Dark**, **Light**, and **Black**. System resolves to
Light/Dark through `prefers-color-scheme`; Black is a distinct OLED palette.
The selected appearance is cached before React bootstrap and synchronized through
the existing settings collection. Accent color is separately account-synced.

## Prefer semantic color roles

Define palettes in `src/index.css` on `:root`, `html[data-theme='light']`,
and `html[data-theme='black']`. Consume them with the semantic Tailwind aliases
in `tailwind.config.js`, rather than introducing another hard-coded dark hex:

| Role | Tailwind utilities |
|---|---|
| Main/app surfaces | `bg-background`, `bg-surface`, `bg-surfaceHighlight` |
| Pressed/hover surfaces | Existing mapped `bg-[#333333]` and `hover:bg-[#333333]` |
| Borders | Existing mapped `border-[#333333]` and `border-[#444444]` |
| Foreground | Existing theme-remapped `text-white` for primary and `text-gray-300`, `text-gray-400`, `text-gray-500` for secondary/muted/faint |
| Selection toolbar | `bg-surface`, which is readable in all palettes |
| Messages | `bg-mosaicIncoming` for incoming, `bg-surfaceHighlight` for outgoing, nested `bg-surface` and `bg-surfaceHighlight` for quotes |

Older exact dark-color class remaps remain only for migration compatibility.
Do not expand global CSS selectors that infer semantics from unrelated class
fragments, descendants, or arbitrary inline `background-color` styles.
They cause light-on-light and dark-on-dark contrast bugs when new surfaces
reuse those classes. Prefer an explicit surface/text pair in the component.

**Inline category/task colors:** user-selected category color is data, not a
theme color. Keep the stored hue unchanged across all appearance modes. Owner
and friend category pills render the existing `getCategoryLabelColor` result
directly; do not darken or blend category labels in Light mode. Completed
task checkmarks remain white on the original category-color fills, including
on friend views; the existing owner-task shadow helps separate the white
glyph from lighter colors. Text in completed Calendar task blocks may still
use `getReadableTextColor(categoryColor)` for legibility without changing
the fill. When the user selects Category text for unfinished Calendar task blocks,
use the stored category color unchanged across appearance modes.
Some colors may have reduced readability against the task block background.
Category text must omit the generic `text-gray-300` utility on its block:
Light/Black theme remaps use `!important`, which otherwise overrides the
category foreground even when supplied inline. Category border uses the
original stored hue as an inset outline, without resizing the task block. The Default option preserves prior rendering.
Selection tint may derive from the category hue, but its text
must use the normal theme foreground rather than assuming an opaque category
fill.

**Accent/semantic colors:** brand-action styling uses the existing accent
tokens and `src/lib/accentColor.ts`, including the contrast-aware accent
foreground. Success/online, error/destructive, warning/offline, and holidays
remain semantically fixed colors; do not reroute them through the user accent.
Translucent overlays and photo backdrops are intentionally separate from
normal readable content surfaces.

## Nested BottomSheet depth

Shared BottomSheet owns sheet/backdrop paint order for every open layer. Each
nested backdrop must shade the sheet below it (not sit behind the parent's
surface), and the inactive parent recedes subtly while keeping its contents
mounted for a smooth return. Only the top sheet owns focus, pointer actions,
drag gestures, and Back dismissal. Child sheets use existing semantic surface
and border colors across Light/Dark/Black; no caller should assign its own
stack z-index or themed child-sheet color. Reduced-motion preferences apply
to depth transitions as well as opening and closing animations.

## New-feature checklist

1. Preview each state in Light, Dark, Black, and System-following-Light/Dark.
2. Inspect normal, selected, hover, pressed, focused, disabled, empty, and
   loading states; nested sheets, chat metadata, overlays, and native date inputs.
3. Validate computed foreground/background contrast at runtime: normal text
   should meet WCAG AA 4.5:1, large text 3:1, and meaningful control boundaries
   3:1. Inspect translucent layers after compositing, not just raw token hexes.
4. Exercise category palette and accent combinations without changing stored
   category values. Ensure focus rings remain visible and don't remove
   keyboard/touch semantics.
5. Add tests for stable behavioral/accessibility contracts. Use browser tests
   only when computed colors or rendering are essential; do not assert incidental
   Tailwind class names or pixel-perfect decoration.
6. Verify production build/PWA size budget, then perform manual mobile and
   desktop visual acceptance. Browser tests are not evidence of a physical
   device check.

See `docs/ACCESSIBILITY_AUDIT.md` for the separate accessibility protocol
and `docs/TEST_WORKFLOW.md` for test selection.

## Single-accent placement toggles (issue #953, v0.34.4)

Mosaic has **one** user-selected App accent color, cached and account-synced through the existing global accent preference. The UI placement editor contains no color picker: it only switches the global accent on or off for predefined roles. Per-component hues are not supported.

The independent roles are Calendar grid, profile ring, navbar icons/labels (never its background), independently selected navbar state, interactive accent icons, accent links/labels, buttons/controls, holiday labels/date accents, month/date headers, weekday headers/day numbers, Settings/subroute text and separately Settings/subroute icons. Each role uses the existing owner-synced `uiColor:<role>` setting key, now storing only a boolean. The resolver safely interprets legacy `default`, `app`, and curated palette values from the initial #953 Preview; legacy palette values mean **on**, never a separate color. Defaults preserve the prior rendering: existing global accent consumers (icons, accent labels, controls) follow the App accent, while new placements remain off.

`src/lib/uiColors.ts` applies CSS variables scoped by `data-ui-*` attributes; Calendar cells receive no new React color props. CSS `mosaic-*-header`, `mosaic-settings-*`, and `mosaic-holiday-*` selectors limit color changes to the chosen text regions without altering category/task data or destructive semantics. Text accents use WCAG AA foreground tokens for dark/light backgrounds, and holiday labels are evaluated on their translucent tinted fills.

The navigation placement leaves the navbar background and border unchanged; both glyphs and captions use the contrast-adjusted app accent when enabled. The separate Active navigation placement can recolor only the active tab and indicator. `settingsText` covers headings, row labels and chosen descriptive text in Settings, Preferences, Notifications settings, Release History and editable Profile. `settingsIcons` separately covers marked Settings row/selection icons, back controls and safe subroute icons; destructive and warning symbols retain their semantic colors. Both Settings toggles start disabled for backward-compatible rendering. No broad page-wide SVG or paragraph class remaps.

The Preferences **Accent color** section now contains both the single App accent picker and the **Where accent color appears** row in the same section. The default-off `uiColor:generalText` role colors selected authored interface labels and headings across Home controls, Explore, Messages, Chat empty states, Alerts, Account, Backlogs, Friend Calendar and Bucket List. Those elements explicitly opt into the `mosaic-general-text` selector. It never broadly recolors `p`/`span`/all headings by DOM ancestry; user-authored messages, alert bodies/actor names, tasks, categories, entered notes, and semantic state/errors are intentionally left alone. It is separate from the Settings text and existing Date/Day header switches, and draws the same contrast-aware dark/light App accent foreground tokens with no React props or runtime text scanning. Additional screens can opt in by marking authored UI copy instead of adding another unrelated palette.

The v0.34.4 follow-up adds two **default-off, independently synced** placements: `uiColor:friendCarousel` changes the *selected friend/person pill* fill and border to the single App accent, chooses the matching readable foreground, and colors inactive pill labels while retaining their original neutral surfaces, avatar images and carousel swiping. `uiColor:bottomSheetText` changes the shared BottomSheet heading plus *explicitly marked* authored sheet labels/copy (including the Home menu, category visibility/reorder copy, and accent placement settings). The heading styles apply to sheets portaled outside the page tree and do not descend over arbitrary task/chat/category content. Accent contrast is measured against actual dark sheet highlight and light elevated surfaces, rather than only the app background.

The existing default-on `uiColor:icons` role now also covers intentionally marked neutral Home search/open/close, hamburger and menu glyphs, friend preferences and Calendar month arrows. These are scoped with `mosaic-action-icon`; error/success/online status glyphs keep semantic colors. General page text continues to color page-level copy and is not a proxy for every bottom sheet label.

Switching an optional role off preserves the existing theme appearance. Turning off an original global-accent consumer applies neutral theme tokens (not a separate green hue), without changing the single account accent setting. Validate cold-start/cache, account switching, sync, contrast in every appearance, dense Calendar/zoom and native devices before dev promotion.

## Reusable single-choice selects (#1126)

Use `src/components/ui/MosaicSelect.tsx` for ordinary single-choice inputs instead of adding a native browser `<select>` or copying a popup into a page. The default styling is a Mosaic rounded surface; `variant="compact"` provides the Timeline filter treatment, and `variant="category"` preserves category-pill styling. Pass owned state and stable strings; the primitive never persists a value.

```tsx
<MosaicSelect
  label="Timeline order"
  value={timelineDirection}
  onChange={setTimelineDirection}
  options={[
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ]}
/>
```

Category options may add a color dot and contrast-safe `textColor`. The component supplies a viewport-clamped, portaled listbox with keyboard navigation and outside dismissal; do not nest its options inside a separate drag/swipe handler. Keep existing native date, time, file and multi-choice controls native or use their respective specialized components. Confirm keyboard, mobile, sheet nesting, long-list, and contrast behavior when adding a consumer.
