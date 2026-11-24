# Issue #2298 — body-level inspector portal A/B (nonpromotable)

Source baseline: stable v0.130.10 `feature/2298-category-gesture-repair-v01309-20261124@51611bbade3fb94621405ac9279393af94888d28`. Owner reports **side-panel dragging remains severely laggy** after dnd-kit 0.5.3 upgrade. Previous sanitized native Chromium traces showed 136/136 side-panel document-root Layout calls, versus 173/223 partial-root Layout calls in bottom sheet; UpdateLayoutTree p95 121.73ms vs 34.34ms. No guarantee which source mutation causes the stall; do not claim a full fix.

## Opt-in differential

Experimental URL flag `?mosaic2298BodyPanel=1` makes **only Day View side panels** render via a fixed body portal. A noninteractive in-flow slot stays in the Calendar flex layout with the same measured side, width, and height; a slot-only ResizeObserver and ancestor-scroll listener align the visible portal. The normal URL has identical unmodified stable product behavior; no settings or user data touched. No feature/Preview/dev/main merge of this test-only flag.

## Synthetic evidence

- [Geometry contract #45419454455](https://github.com/carlers/mosaic-life-tracker/actions/runs/45419454455) success: left/right, grid/screen, divider resizing and task pickup.
- [Matched dense trace #45420036941](https://github.com/carlers/mosaic-life-tracker/actions/runs/45420036941) success: synthetic 7,776-node Home tree, 14 category headers and 13 active tasks, same viewport and task/category gestures. Inline side panel Layout: 0 partial / 57 whole-document. Portaled side panel: **36 partial-rooted / 21 whole-document**. Document style recalculation totals **1,145.45ms inline vs 1,175.92ms portal**; the difference is too small/in the wrong direction to claim overall performance improvement, and maximum style recalc was 450.61ms vs 473.96ms. Both retained approximately 31,000 style-rule invalidation records; root stylesheet churn is still present. Synthetic sheet remained whole-document on these synthetic gestures despite the owner's native partial-root observation, so real-world behavior does not transfer directly. These findings support an architectural isolation mechanism, not demonstrated owner-device speedup.
- All synthetic data; browser requests restricted to local fixture origin.

## Preview acceptance

Require full exact-SHA CI/browser, official Vercel READY target=null, project `prj_jysOLDbuO9c5rP8x6Q145DVIw0fc`, Appwrite Preview `6ae94a2100014d01f5ed`, PWA and blocking size PASS. **Do not promote this diagnostic branch.**

Owner tests baseline and opt-in **on the same immutable deployment** with identical side panel width and date. Prioritize task boundary drags, note↔category-boundary dragging, category pills and grouped Diary, close/reopen, resizing, calendar navigation, scrolling, no ghosts or clipping. Owner reports just perceived performance/bugs; no new native trace unless necessary. If portal is not clearly better, discard and investigate continuous drag styles/React layout updates rather than shipping complexity. Independently investigate the remaining global style-rule invalidations.
