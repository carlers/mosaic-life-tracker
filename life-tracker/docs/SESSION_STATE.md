# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #953 — broaden single-accent placement into general application interface text and regroup Preferences.

## Authorization / exact base
- Owner requested more customizable visible UI text in Home, Messages, Alerts, and other pages, using one general option; move placement preferences **under the Accent color category**.
- Current `dev@27c4725e382c8f57b6302c382fc4ece7f30d05b2` v0.33.2 unchanged.
- Source stable `feature/ui-custom-colors-953-20261020@24d80a125181f922b81a788f029ac3b2fccf721e`, v0.34.2, fully validated in #953 issue checkpoint.
- Work on `chatgpt/953-general-ui-text-20261020`; next stable Preview patch v0.34.3. No dev/main/Production approval.

## Scoped implementation
- Add default-off account-synced `uiColor:generalText` with same `applyUiColors`, cache, contrast-aware dark/light roles. Select authored interface labels/headings and safe copy in Messages, Alerts, Chat empty copy, Home ViewSwitcher/HamburgerMenu and view toggle, Explore, Account, Backlogs, Friend Calendar, Bucket List, without changing user-authored data or semantic status/error text.
- Single stylesheet `.mosaic-general-text` opt-in selector applies the one App accent only to marked elements, no generic global p/span/h1 selector or per-day React updates.
- Move `UiColorSettings` row into Preferences Accent color section next to the palette picker. One section `aria-labelledby` provides stable semantic grouping. Existing Settings text / icons and navbar roles unchanged.
- Unit checks validate defaults, matching accent tokens and disabled cleanup. DOM test validates group and generalText switch persisted separately from accent color. Version v0.34.3 and theme docs updated.

## Next gates / handoff
- Coherent task commit with `[verify:focused]`; repair focused failures. Squash task PR into stable feature Preview, require exact-SHA full canonical CI and trusted Vercel READY on Scratch. No backend/schema change.
- Manual device and appearance contrast (Dark/Light/Black) and Scratch login/origin/cross-device sync remain outside automated checks and must not be claimed as verified. Keep #953 open until owner accepts.
