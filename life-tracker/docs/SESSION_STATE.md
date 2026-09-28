# Session checkpoint

Updated: 2026-09-28
Current task: server-controlled friend requests and recovery of existing invisible requests.
Status: live Preview acceptance found an Appwrite transaction TTL incompatibility; fix in progress.
Next action: fix Appwrite transaction TTL minimum, verify the handler regression, redeploy message-action, then resume Preview acceptance.
Blockers: full restore rehearsal remains deferred; current blocker is the live friendship transaction TTL incompatibility.

## Working set
- appwrite-functions/message-action/
- src/lib/social.ts
- src/lib/socialOutbox.ts
- src/lib/friendshipCommands.ts
- src/lib/friendshipSync.ts
- src/hooks/FriendsProvider.tsx
- scripts/repair-friendships.mjs
- docs/FRIENDSHIP_RECOVERY.md

## Completed substeps
- Live audit confirmed two incoming requests grant their sender access and lack outgoing peers.
- Added transactional server lifecycle, version checks, caller-owned read permissions, and account cleanup.
- Client commands replace optimistic relationship writes; friendship sync is read-only with legacy reconciliation.
- Added audited repair tooling and personal/DR restore compatibility coverage.
- Handler and DOM suites passed; production build/PWA/size checks passed.
- Fresh DR snapshot 20260928T121205995Z completed: 4 users, 1,298 rows, 80 files (execution 6aba58f234bf5b098f93, HTTP 200). No live friendship repair has run.

## Remaining substeps
- Complete focused safety tests and diff review; commit/push exact-SHA full canonical acceptance.
- Isolated rehearsal, fresh backup verification, Function deployment, audited live repair, compatible Preview.
- Hosted two-account lifecycle/messaging/calendar acceptance, recorded separately from mocks.

## Constraints
- Preserve row IDs and schemas, account isolation, tombstones, and provider ownership.
- Never repair through personal restore or resurrect blocked/deleted relationships.
- Backend before client; no insecure permission rollback; no automatic promotion to dev/main.
- Task branch: chatgpt/friend-request-delivery, based on dev 722c43e.

## Verification
- Server acceptance initially failed for unsupported friendship action; the new deployment exposed an Appwrite transaction TTL incompatibility (30s below the 60s minimum).
- 85 handler tests and 252 DOM tests passed before final regression additions.
- Handoff CLI tests require unsandboxed temporary Git fixtures; all three passed there.
- Build/PWA/size passed. Full canonical and hosted checks remain pending.
