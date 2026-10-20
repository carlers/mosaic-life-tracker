# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #953, v0.34.4 — friend carousel, utility action icons and shared bottom sheet text accent placements.

## Authority and baseline
- Owner requests expanding the single App accent roles to friend carousel, search icon, hamburger, bottom sheet text, etc. Existing Preferences > Accent color grouping remains.
- Current baseline stable Preview `feature/ui-custom-colors-953-20261020@878b763fdef50570e8d28cdab15a3ea30aa7573a` v0.34.3 passed exact SHA full CI + trusted Vercel READY (issue #953 checkpoint); `dev@27c4725e382c8f57b6302c382fc4ece7f30d05b2` unchanged.
- Task branch `chatgpt/953-carousel-sheet-icons-20261020`, expected patch v0.34.4, no dev/main/Production authorization.

## Scoped implementation
- New default-off account-sync/cache `uiColor:friendCarousel`: selected pill uses accent background/border and readable contrast foreground; inactive pill labels use theme-aware readable accent text, while avatars, neutral inactive background and carousel interactions remain unchanged.
- Existing `uiColor:icons` now colors explicitly marked neutral search/open/close, Home hamburger, menu icons, friend-carousel preferences and calendar arrows, but not semantic status icons.
- New default-off `uiColor:bottomSheetText`: shared portal BottomSheet heading and explicitly marked static menu/placement/category-manager labels. No blanket descendant text or unsafe user-entered/task/category/message changes; contrast chosen for elevated Dark/Light sheets.
- Keep single App accent palette and other roles, Preferences grouping, category/task colors, sheet dragging/keyboard/focus unchanged. No Appwrite schema/sync changes.
- Update unit/Preferences DOM tests, theme documentation and package/app version v0.34.4.

## Delivery to complete
- Make one coherent task commit [verify:focused] with this checkpoint, repair any CI issues, squash task PR to stable feature Preview, verify canonical Quality Gate and exact-SHA trusted Vercel READY. Manual device contrast/motion/sheet nesting plus Scratch browser-login, offline startup and cross-device sync remain unverified.
- Do not merge Preview to dev/main or touch Production/1.0. Keep issue #953 open.
