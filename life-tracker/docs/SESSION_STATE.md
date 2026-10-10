# Session checkpoint

Updated: 2026-10-10
Issue: #406 — shared tasks with friends; user authorized implementation.
Branch: `chatgpt/shared-tasks-contract`; exact starting `dev` `224f8a700f35bbe3853206ee208e1dc103ece5b3` (v0.12.1). `dev` and `main` remain unchanged.

## Implemented, not yet deployed
- Server-only `task_shares` table (one row per invited collaborator), managed additive migration 007, reciprocal friendship/grant-epoch checks, owner/invitee isolation, strict task projection, version-checked transactional completion and idempotent membership/completion operations. The first invitation transaction also removes legacy direct owner-update row permission, keeping Function-owned owner CAS as the update path.
- Account-scoped persistent completion and invitation/decline/leave offline queues, stable operation IDs, bounded retries, terminal conflict persistence, settlement-driven refetch and per-user sanitized offline caches. Owner-offline RxDB writes use field-level merge on independent title/date changes, reject conflicting completion intents, and persist a sync warning. Cross-account invalidation and account deletion cleanup wired.
- Owner share-action BottomSheet, independent invites/revocations, recipient Explore inbox and virtual Day View shared group, pending-sync status; personal task categories and order remain separate. Prevent mislabeled task-completion Alerts for pending/accepted shared tasks. Personal backups never restore social grants; erasure policy includes both owner/invitee.
- Unit/handler/DOM fixture coverage added. Recent focused checks were green through `38fdc440`; `afded33b` failed two newly added mock/expectation regressions, not a confirmed application failure. The next task commit repairs those fixtures and requests new focused verification.

## Unresolved release gates
- Prove the first-invite row-permission change and transaction/CAS conflicts on real Scratch Appwrite, including owner edits under the updated permission set and pre-upgrade browser behavior. No schema/Function resource has been changed in either Appwrite environment.
- Owner completion path still uses local RxDB writes rather than the same versioned command outbox as collaborators; per-owner-task pending UI and all owner completion entry points need a complete proof/contract. Offline stale owner bootstrap and multi-tab overlap remain to stress-test.
- Scratch three-account, multi-device/offline/reconnect/revoke/delete/erasure, DR restore and legacy-client behavior, notification attribution, all themes/gestures and physical mobile acceptance are **unverified**.
- Reconcile candidate MINOR version against other active Preview branches, stamp and run focused + stable Preview full canonical/PWA/size CI and Vercel READY only once the product contract passes. `dev` and `main` promotions require separate explicit approval.

## Next action
Review new focused run; resolve any failures. Complete the owner-completion/old-client acceptance gate without speculative sync refactoring. Follow issue #406 and `docs/SCRATCH_PREVIEW_WORKFLOW.md`; do not activate the new Function before migration 007 and Scratch authorization tests.
