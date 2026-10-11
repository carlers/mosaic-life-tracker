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
the fill. Selection tint may derive from the category hue, but its text
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
