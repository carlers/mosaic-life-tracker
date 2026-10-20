# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #951 — Day View timestamps and chronological Timeline Mode.

## Boundary
- Working branch: `chatgpt/dayview-timeline-951-20261020`, based on `dev@0606ff3aebf565cd47f1fe9bc4e53cf64a1499a0`.
- Preview candidate `v0.36.0`, distinct from active #956 keyboard Preview `v0.35.0`.
- Source/UI + owner settings only: no backend/schema changes, no Appwrite production operations, no Preview/dev/main promotion approval.

## Implementation
- Add optional created/completed timestamps in ordinary Day View, with account-synced independent visibility and icon-vs-text labels.
- Add account-synced Categories/Timeline mode and ascending/descending direction, client-only deterministic chronology, category and completion filters, and category-aware quick-add.
- Reuse TaskItem for checkbox, edit, memo, photo, selection and task actions. Canonical category/manual task order remains unchanged.
- Diary and shared-task content remains in Categories view; Timeline displays explicit guidance.
- New pure sorting/formatting tests.

## Verification
- Connected GitHub editing environment cannot run local npm/browser tests or authenticated device testing.
- Focused CI requested by task commit; check its result before claiming verified or preparing stable Preview.
- Manual cross-device sheet swipes, task editor focus, scroll, selection, quick-add, and visual/a11y acceptance outstanding.

## Next action
- Inspect focused CI for this exact task SHA and fix any failures. Then submit to stable Preview for full canonical CI + trusted Vercel READY, obtain owner device acceptance; no automatic dev/main promotion.
