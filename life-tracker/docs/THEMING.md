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

## Owner Calendar wallpaper presets (#2000, v0.102.0)

The optional Calendar wallpaper setting uses two existing owner-scoped, synced values:
a bundled preset ID (default `none`) and a bounded dim percentage (default 55,
valid 35–80). Original SVG art in `public/wallpapers/` is precached for offline
PWA use. No photo, binary upload or backend schema is involved.

A single stationary, pointer-transparent backdrop sits behind the owner Calendar's
non-scrolling host, outside month/week slides. Visuals and contrast CSS load lazily
only for an enabled preset; default Calendar rendering is unchanged. Friend calendars,
Day View sheets and Todo/Diary retain their existing surfaces. Wallpaper-only contrast
treatments should preserve task category and completion colors. Test sticky headers,
month/week and pinch/swipe gestures, dense day grids, light/dark/black, account switching,
offline images and mobile touch. User uploads and a glass appearance are deferred.

### v0.102.1 Preview revision — transparency, range, coverage

For both Month and Week mode, the sticky weekday row remains sticky but has no
opaque surface in wallpaper or default mode, letting the underlying Calendar
background show through. The owner-synced darkness setting now accepts 0–100%
with 1% steps (0 = original image, 100 = maximum dark overlay); existing saved
percentages retain their meaning. Missing/malformed values still default to 55%.

The new owner-synced coverage key `calendarWallpaperScope` defaults to `grid`
for compatibility with v0.102.0 and accepts `home` for the full Home workspace.
Only the active owner's Calendar mounts wallpaper: in grid mode a single stationary
paint sits under the date header, while Home mode portals that same paint behind
search, status/menu, friends carousel, avatar/profile and date header. The two
opaque Home header wrappers become transparent only in Home mode, with localized
legibility shadows; distinct buttons, task fills, modal sheets, secondary routes,
friend calendars and global bottom navigation retain their behavior. Switching
away from the owner or selecting None removes the Home effect and restores the
normal surfaces. No user uploads or new backend schema/Function is introduced.

#### Full-Home ownership refinement

The owner mounts the optional Home wallpaper while active in Calendar, Todo or
Diary, not only when the Calendar grid happens to be mounted. In grid mode,
the Calendar alone mounts the backdrop. The optional paint portals into the
stable Home workspace (outside Swiper clipping); presence of that direct portal
child drives `:has()` CSS for isolation and transparent upper header wrappers.
No imperative DOM attribute/class mutation is needed. When the owner is inactive,
selects None, or changes coverage, unmounting the portal automatically reverts
header backgrounds. The existing global bottom bar and friend calendars remain
unaffected.

### v0.102.2 — Day-cell touch highlight and other protected pages

A touch device may retain the day-cell button's CSS `:hover` after Day View
closes and focus is restored for keyboard accessibility. With a wallpaper
selected this can look like an opaque black rectangle. Wallpaper-only CSS
suppresses only the touch-browser stale hover fill `@media (hover: none)`;
mouse hover and `:focus-visible` keyboard rings remain unchanged. No global
hover or keyboard navigation contract is disabled.

A new owner-synced `calendarWallpaperOtherPages` Boolean (default `false`)
controls additional wallpaper coverage independently of `calendarWallpaperScope`
(the existing Home grid/full choice). When enabled with a selected preset, a
separately lazy, pointer-transparent stationary paint uses the *same* bundled
artwork and dim setting behind protected Explore, Alerts, Chat, Me, Settings and
Settings subpages (also eligible Backlog and Bucket List detail routes). It is
never mounted on Home, friend calendar routes or unauthenticated screens. Its
presence alone activates scoped CSS transparency for eligible top-level page
surfaces and sticky header backgrounds; cards, input fields, chat bubbles,
sheets, dialogs, global bottom nav, and safety overlays retain their surfaces.
Light/Dark/Black theme conventions remain in force. A stored preference alone
cannot load an external image; unknown preset IDs still resolve to None.

Manual/mobile verification: tap a day, dismiss Day View, ensure its restored
focus ring is accessible without persistent opaque fill; month/week scroll;
other page backgrounds and their headings; chat composer and scroll; the
Settings subpage transition; account switching; offline PWA background; None
and opt-out revert immediately; full Home grid/home selection is independent.

#### v0.102.2 protected secondary page token parity

In addition to the classic dark `bg-[#111111]` page root and sticky header,
Backlog, Bucket List, Storage and Release History use `bg-background`. The
opt-in wallpaper stylesheet makes only these **top-level route wrappers** and
sticky header fills transparent, including theme remapping in Light/Black, so
the same background reaches all eligible protected destinations. A form field
or content card using `bg-background` retains its fill, since it is neither
a top-level page root nor a sticky header. No default page styling changes.

#### Protected background mount isolation

The optional non-Home wallpaper is created in the authenticated, data-ready
`AppDataShell` rather than unconditionally instantiating a settings-aware lazy
component in the reusable presentational `MainLayout`. The latter receives
an optional background element, keeping standalone Chat gesture/scroll harnesses
free from extra setting subscriptions when wallpaper is disabled. For actual
protected routes, the element remains beneath `main` and outside the content
transition and doesn't change page or modal geometry. Independent scoping
prevents this wallpaper from rendering on Home, a friend's calendar or auth.

### v0.103.0 Preview — per-page wallpapers, Mosaic controls, five uploads

The formerly global `calendarWallpaperOtherPages` checkbox is replaced with an
owner-synced `calendarWallpaperPages` map. Choices are independent for Explore,
Alerts, Chat/conversations, Me/profile, Settings, Settings subpages, and other
authenticated pages including Backlogs and Bucket List: `off`, `home` (inherit
Home's selection), or a distinct bundled/uploaded wallpaper. Existing users
with the prior global opt-in enabled migrate behaviorally to `home` on all
unspecified routes. Missing/invalid page choices fail closed to Off. Home grid
versus full-Home coverage remains independently owner-synced.

The settings UI uses MosaicSelect listboxes and accessible pressed buttons
rather than native checkbox/radio controls. Any selected wallpaper shares the
single brightness setting (0–100), including uploads and other pages. No photo
picker is mounted outside owner Preferences > Calendar; no default Home
additional eager code. Each page's wallpaper is noninteractive and never
mounted on login or friend calendars.

An owner can upload **at most five private WebP images**. All five upload
slots have deterministic account-specific Appwrite Storage file IDs in the
existing `task_images` bucket; a sixth cannot be allocated by the UI, even
when another device races on the same slot (409 is an error, never overwrite).
Only authenticated owner `read/update/delete` file ACLs are used; no public
media URLs or cross-user access are granted. JPEG/PNG/WebP originals up to
12 MiB are compressed client-side to WebP at max 1920 px and max 1 MiB
stored. The existing authenticated download and bounded IndexedDB image cache
support offline display after the photo has been downloaded. The tiny
`calendarWallpaperUploads` setting stores owner slot metadata, not image bytes
or raw object URLs. Direct deletion is permitted only for one of the owner's
fixed wallpaper slots after explicitly confirming and clearing owner wallpaper
references; existing task/Diary media deletion restrictions remain untouched.
Other clients may hold stale cached bytes until refreshed; this UI is not a
cross-device image revocation mechanism.

MVP does not add backend tables, Functions, migration, user-defined crop or
per-page brightness. Mobile acceptance should cover five uploads and sixth
rejection, ownership/account switch, offline image after caching, deletion
clearing active references, per-page selection persistence, settings navigation,
light/dark/black contrast, chat composer and keyboard, and Home gestures.

## Wallpaper-aware interface materials (#2000, planned v0.107.0)

Soft Frosted is the default **only over an authenticated owner's active wallpaper**;
Solid is an account-synced opt-out stored under `calendarWallpaperMaterial` in
the existing Settings collection. The saved choice does not load wallpaper or
modify pages where wallpaper is Off. It is exposed alongside the Calendar
wallpaper picker and linked from Appearance & Layout. Unknown values resolve to
Soft Frosted. Friend calendars, authentication pages and absent images never
enable the material. No backend migration, media ACL or data-sharing change.

Material tokens and CSS live in `components/layout/WallpaperMaterial.css`,
lazily imported by the existing wallpaper backdrops. Explicit
`mosaic-material-control`, `mosaic-material-header` and
`mosaic-material-panel` classes opt **specific** components into a light or
reading-strength tint. Keep BottomNav frosted only on secondary routes with
wallpaper under the entire viewport; the Home wallpaper does not extend under
that nav. Keep diary editors, chat bubbles/composer, security surfaces and the
shared BottomSheet opaque. Completed task fills and category colors stay
unchanged; incomplete Calendar preview fills can soften without a per-task blur.

Material rules require `backdrop-filter` support. Unsupported browsers,
the Solid choice, `prefers-reduced-transparency: reduce` and forced-color
environments use opaque semantic surfaces. Avoid per-day/per-row backdrop
filters, unbounded scroll listeners, new dependencies or animation. Verify
Light/Dark/Black, dim extremes, user photos, None and per-page selections,
friend/account switching, Android Brave touch focus and previous black-stripe
fix, PWA offline rendering, keyboard/sheet nesting and WCAG composited contrast.
Do not loosen current blocking initial/Home gzip budgets to deliver this.

### v0.107.2 Preview refinement — adjustable glass and text chat

The wallpaper material setting retains the default **Soft Frosted** and explicit **Solid** opt-out. A separate owner-synced `calendarGlassTransparency` value (0–100 in steps of 10, default 50) controls *relative wallpaper visibility* rather than absolute CSS alpha: 0 is more solid, 100 is clearer. `resolveGlassTransparency` rejects malformed values and clamps/snap-rounds numeric input. The opt-in wallpaper backdrops carry this value as `data-glass-transparency`; only owner-scoped CSS `:has` hosts expose the effective alpha variables. The default no-wallpaper entry point does not hydrate extra state or material CSS. The range intentionally retains a minimum tint for readable text and does not modify the wallpaper darkness setting.

Chat conversation detail now lets a selected page wallpaper show through the chat root (including when Solid is chosen). Header and dock chrome may frost in Soft Frosted mode. The message textarea, linked diary previews, task references, deleted bubbles and dialogs stay solid. Ordinary incoming/outgoing *text* bubbles receive separate theme-aware translucent colors without individual `backdrop-filter` layers, preserving long-chat scrolling, selection, keyboard insets and message gesture handlers. Images/stickers remain untouched. For browsers without `backdrop-filter`, reduced-transparency, extra-contrast or forced-colors mode, all eligible materials, bubbles and dock fall back to solid. Validate Light/Dark/Black, 0/50/100, user wallpaper photo contrast and chat swipe/reply/reaction on a real mobile browser before promoting.
