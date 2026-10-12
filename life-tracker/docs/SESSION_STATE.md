# Session checkpoint — Mosaic issue #408

Updated: 2026-10-13.
Current task: #408 drag UX refinement v0.25.2 implementation on isolated task branch.
Next action: Complete [verify:focused] CI, squash into `feature/diary-408` only after green, verify the exact stable SHA's canonical gate and Vercel Scratch Preview READY, then request manual gesture acceptance. Never merge dev/main without approval.

- Starting source: `feature/diary-408@b5b3507c29d01c2200878d136a92b646d9e6e8ec` (v0.25.1), authorized isolated branch `chatgpt/408-drag-ux-20261013`.
- Scope: source-bound, full-height diary dragging; eliminate generic diary overlay and faded duplicate; register the visible task source, avoid Motion-owned height/opacity-zero active slots, retain layout position measurement through hover/drop, remount the drag runtime on date/account changes, and keep optimistic diary drop geometry until the persisted placement catches up.
- Reuse existing 500ms pointer sensor, category/task/drop projections and full task overlay. No messaging, schema, Function or Scratch deployment changes.
- Verification: source-level review and a unit regression for outside-drop/no stale projection; initial focused CI failed two React effect-state lint checks; repaired by keyed remount and event-driven cleanup; rerun is pending. Browser/device checks not performed at this source checkpoint. Manual acceptance checklist extended in `docs/MANUAL_TASK_REORDER_ACCEPTANCE.md`.
- Version: v0.25.2 PATCH candidate, changing package, lock and appVersion in one tree. dev v0.23.4 and main v0.17.4 when inspected; do not assume other concurrent Preview versions without checking.
- Delivery constraints: stable Preview acceptance only; retain compatible active Scratch Function and existing social behavior. Existing stable v0.25.1 hosted Preview remains the fallback until v0.25.2 is verified.
