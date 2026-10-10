# Session checkpoint

Updated: 2026-10-10
Task: GitHub issue #406 — shared tasks with friends. User authorized global completion, multiple invitees, minimal shared fields, offline queued collaborator actions.
Live base: `dev` `224f8a700f35bbe3853206ee208e1dc103ece5b3` (v0.12.1). Task branch: `chatgpt/shared-tasks-contract`. Production `main` unaffected.

## Scope and current work
- Initial server foundation: server-owned `task_shares` membership/invitations, managed migration 007, transaction-backed completion with stale-revision failure and idempotency, minimal field projection, revocation/erasure coverage, shared-task Alerts suppression and focused tests.
- No user-visible release or version bump. Do **not** activate the new Function endpoint or promote this partial slice yet.
- A separate account-scoped durable completion command queue and unit tests are now staged; it uses explicit desired-state commands, stable IDs, bounded retries and fail-closed stale revisions, but has not yet been wired to the product UI.
- Open gate: owner RxDB task completion is owner-owned and only friend reaction drift is specially merged. Prove owner offline completion/title edits alongside participant completion; otherwise reject rather than losing edits. Also finish queue lifecycle integration, owner/recipient UI, test/migration review, DR/restore/legacy-client compatibility and scratch live 3-account acceptance.

## Next action
Run focused CI on exact task commit and repair failures. Continue the Phase-0 owner-sync proof; proceed to client/UX and gated scratch acceptance before the stable Preview. Reconcile version reservation against live branches then. Issue #406 is the task plan.
