# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #951 — Timeline category popovers and timestamp-priority sorting.

## Authority
- Previous user-testable stable Preview: `feature/dayview-timeline-951-20261020@82185e7cf6b77057a9691d4902fe62e5638b59d7`, v0.36.1; canonical CI https://github.com/carlers/mosaic-life-tracker/actions/runs/39447399754 SUCCESS, trusted deployment https://github.com/carlers/mosaic-life-tracker/actions/runs/39447789156 SUCCESS (Vercel READY).
- Current task branch: `chatgpt/951-timeline-category-sort-20261020`, based on the exact v0.36.1 Preview. Candidate next user-testable PATCH v0.36.2.
- Scope is owner Timeline frontend, sorting helper and synced settings only. Never auto-promote to dev/main or Production; no backend/schema migration.

## Changes under review
- Replace native category select menus in Timeline category filter and quick-add category pill with custom Mosaic-themed popup menus. Colored category choices, checkmark, focus/keyboard Escape, arrow, Home/End, outside-pointer dismissal. Status select remains native.
- Remove new-task title field's accent-colored focus ring; retain normal category-color underline, input semantics and submit flow.
- Add account-synced Timeline basis: completion-first default (completed tasks use completion timestamp, creation fallback) or creation-first (all tasks primarily use creation timestamp, completion fallback). Newest/oldest direction remains independent, and visible Timeline timestamp follows selected basis.
- Preserve invalid timestamp handling and ID tie-break, category and manual task order, day swipes and existing task workflows; extend pure sorting/default tests. Update Preferences and inline sorting controls.

## Required verification
- Coherent task commit `[verify:focused]` and exact task-SHA focused CI; review full diff and repair failures.
- Squash into original stable feature Preview only after focused green; require successful canonical CI and trusted Vercel READY on exact resulting SHA.
- Physical Android/iOS gestures, menu clipping, theme contrast (Dark/Light/Black), authenticated Scratch Preview login and cross-device settings sync remain manual/unverified until actually exercised.
