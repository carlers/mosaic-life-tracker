# Session checkpoint

Updated: 2026-10-12
Current task: Category Manager expansion/switch motion, v0.20.8 Preview only.

## Category Manager motion correction
- Base stable Preview `fix/category-editor-inline-20261012`. Original v0.20.8 task `chatgpt/category-editor-motion-flow-20261012` @ee98201f; squash stable @41e31f638380be8a888c82850955db5e7e656de4.
- Root cause: `Reorder.Item layout="position"` projects sibling positions against the instantaneous editor mount/unmount and causes overpainting during open/close/switch. Early scroll-into-view competes with animation.
- The initial v0.20.8 fix animated real height through Motion and gated reorder position measurements. Focused browser CI 38242677389 SUCCESS (including new frame-by-frame geometry test), but the Vercel GIPHY-enabled build hit +932 B raw, +404 B gzip, +903 B precache above strict unchanged limits (deployment dpl_J9Ejz1F4sadVT3634aTVkazqBTye ERROR). All other four size checks passed.
- Size-safe repair: CSS grid `grid-template-rows: 0fr/1fr` interpolates *actual* panel height in normal flow with clipped inner contents and retained exit contents, while `layoutDependency` isolates Motion layout projections to list ordering. On collapse, controls become inert and aria-hidden; scroll is deferred to height transition completion. This replaces extra Motion editor runtime; no design/backend changes and do not relax size caps.
- Browser regression fixture renders the production CategoryRow and samples real per-frame adjacent category bounds during opening, switching and rapid interrupted switching. Existing DOM coverage preserves edit/reorder/save/cancel.

Next action: Run repair task focused browser check, squash to stable Preview, verify full canonical CI and Scratch Vercel READY plus all seven GIPHY-enabled size caps. Hand off for user mobile/desktop acceptance, no dev/main promotion.
