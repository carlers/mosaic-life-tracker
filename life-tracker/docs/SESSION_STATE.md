# Session checkpoint

Updated: 2026-10-08. Active task: configurable friend-completion Alerts history,
branch `chatgpt/alerts-configurable-retention` from stable
`feature/notifications-alerts` at `8d32924a`.
User approved two account-synced retention dropdowns. No permission to change
`dev`, `main`, or production Appwrite.

## Implemented in current task

- Unread: 1, 3, 7 (default), 14, 30 days after server arrival.
- Read: 1, 12, 24 (default), 72, 168 hours after immutable first read,
  independent of unread duration. Maximum physical receipt lifetime: 37 days.
- Synced account settings via existing RxDB settings rows; no schema migration.
- Recipient's server settings read by exact Appwrite-safe row ID; allowlist
  validation and owner checks; browser payload cannot override retention.
- Server feed, exact push-tap lookup, and mark-as-read enforce the same policy.
  Account cache retains potentially recoverable entries up to its existing
  100-item cap and applies policy at display time. Hourly Function GC uses
  the 37-day bound, while old event replay remains ineligible after 7 days.
- UI: Settings → Notifications has separate read/unread dropdowns above
  device-local push controls. Tests updated for server, DOM, client and GC.
- Source: `src/lib/notificationRetention.ts`, `notificationCache.ts`,
  `pages/NotificationsPage.tsx`, `NotificationSettingsPage.tsx`,
  `appwrite-functions/message-action/{alert-retention,notifications,tombstone-gc}.js`.

## Verification and next actions

- Full task-branch diagnostic initially failed two obsolete/handoff unit
  assertions; repaired at `0cedcaf8` with focused CI green. Squash commit
  `a9f94cf5` passed all canonical CI and browser checks (run 37785073679).
  Vercel's production build exceeded the old three aggregate budgets by
  1,398 / 142 / 1,631 B. The reviewed feature-size allowance on
  `675d9835` repaired Vercel (READY), while canonical CI found a hardcoded
  test assertion of the previous aggregate caps. The current repair updates
  the test to the reviewed ceilings without altering runtime or other guards.
- Disposable scratch Function `message-action` was built from reviewed
  commit `675d9835` and activated after READY at deployment
  `6ac79cde15e80ba98d89`. Read-back confirms activation. If the final
  stable commit changes, repeat exact-commit deploy/activate after READY;
  production Appwrite must remain untouched. Authenticated browser
  retention and push acceptance still require manual phone testing.
- Stable Preview canonical CI + READY Vercel required; share registered
  stable feature alias, not immutable deployment URL. Phone/laptop manual
  retention and push checks remain distinct from automation.
- Older notification rows already permanently deleted under seven-day GC
  cannot be recovered by lengthening retention; the offline cache is capped.
- Project workflow: `docs/APPWRITE_BACKEND_WORKFLOW.md`,
  `docs/SCRATCH_PREVIEW_WORKFLOW.md`, `docs/DELIVERY.md`.
- Previous accepted change: phone manual Sync Now local election grace
  (`8d32924a`), tested by user; Push also confirmed working by user.
