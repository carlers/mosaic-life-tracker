# Session checkpoint

Updated: 2026-10-07
Current task: Ship the Notifications/Alerts tab with friend task-completion activity and optional Web Push.
Status: Implementation and regression coverage are complete on the AI task branch; focused GitHub verification is the next gate. Production Appwrite schema/Function/VAPID rollout has not been performed.
Next action: Run the task branch focused gate. If green, squash into `feature/notifications-alerts`, wait for canonical acceptance and the Vercel Preview, then perform the explicit Appwrite rollout only after repository acceptance.
Blockers: Web Push delivery remains intentionally disabled until VAPID values are configured on the target Appwrite Function.

## Completed evidence

- Replaced the Notifications placeholder with an Alerts feed for visible task completions from mutual friends.
- Added server-owned `notifications` and `push_subscriptions` manifest tables plus idempotent migration `004-notifications` and account-erasure coverage.
- Added task create/update Function events using the Appwrite TablesDB event namespace and deterministic per-recipient completion IDs, with TodoMate/stale/private filtering and live revalidation on reads.
- Added account-scoped offline notification caching, pagination, read marking, task reply/reaction actions, and cache-only primary-route previews so swipe previews do not cause read side effects.
- Added opt-in Web Push support through the existing service worker, including installed-iOS gating, active-account filtering, stale subscription cleanup, and current-account subscription reconciliation without allowing a late reconciliation to overwrite the service worker's active-account marker.
- Added regression coverage for deterministic IDs, imported-task suppression, mutual-friend creation, recipient-side profile metadata, route-preview side effects, account-switch isolation, active-feed read marking, backend migration, and exact Function event configuration.
- Hardened shared Settings switches with an accessible label required by the new Push preference.

## Working files

- `appwrite-functions/message-action/notifications.js`
- `appwrite-functions/message-action/main.js`
- `infrastructure/mosaic-backend.mjs`
- `scripts/migrate-notifications.mjs`
- `src/pages/NotificationsPage.tsx`
- `src/lib/notifications.ts`
- `src/lib/notificationCache.ts`
- `src/lib/pushNotifications.ts`
- `public/push-sw.js`
- `docs/PROJECT_REFERENCE.md`
- `docs/APPWRITE_BACKEND_WORKFLOW.md`
- `docs/PLAN.md`
- `docs/SESSION_STATE.md`
