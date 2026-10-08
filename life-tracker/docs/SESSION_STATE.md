# Session checkpoint
Updated: 2026-10-08. Current work: notifications pre-dev-merge safety review,
task branch `chatgpt/notifications-premerge-hardening` based on stable
`feature/notifications-alerts` at `02f95e4c`. User requested audit and
preparation, **not** merge to dev. Production Appwrite is read-only.

## Review findings and changes

- Stable Preview is 26 commits ahead of dev with no reverse divergence;
  exact-tree promotion is feasible. Prior canonical CI run `37786459130`
  succeeded, Preview READY and scratch Function active.
- Found an event-to-push privacy edge: stale Appwrite task snapshot could
  still create a receipt and generic push after the live task became private,
  deleted, uncompleted, imported or changed owner/completion timestamp.
  Recheck live task **before** creating receipts or sending any push,
  preserving the existing 7-day eligibility and deterministic dedupe.
  Handler regressions include stale/removed/private live tasks.
- Scratch synthetic fixture task/category visibility incorrectly used
  `friends`, which is not a Mosaic visibility enum member. Set both to
  `followers` and add fixture regression assertions; the CLI still
  requires explicit scratch project confirmation and never copies users.
- Production has notifications schema and `idx_notification_created`
  but **does not yet have** `push_subscriptions.include_task_details`.
  Before any main/production Function activation, explicitly apply
  reviewed migration `006-push-details` to production and verify complete
  schema; no production write authorized during this audit.
- Scratch Function schedule is intentionally disabled, while production
  has hourly GC; test 37-day GC in CI, do not silently enable scratch GC.
- Retention defaults 7d unread/24h read; options sync per account,
  37-day physical max, live friendship/task visibility revalidated.
- No production/development branch writes. Required: focused CI for fixes,
  squash into stable Preview, canonical CI and Vercel READY, Function
  deployment of exact accepted commit on scratch, then draft PR into dev.
  The actual dev merge awaits separate user approval.

## Remaining acceptance

- The user confirmed phone Sync Now and push worked in prior Preview.
  Explicit acceptance of new per-account retention controls on **real
  phone and laptop** is not recorded; automated tests alone do not prove
  device sync.
- Scratch synthetic seed operation needs admin API key/password; untested
  against live scratch. Full disposable-account import/Diary sync still
  requires manual acceptance as documented in SCRATCH_PREVIEW_WORKFLOW.md.
