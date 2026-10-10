# Session checkpoint

Updated: 2026-10-10
Current task: Implement issue #406 shared tasks with friends; no dev/main promotion approved.
Source: dev `224f8a700f35bbe3853206ee208e1dc103ece5b3` (v0.12.1).
Stable Preview: `feature/shared-tasks` at `088cdb7ad0c9001af42b66c90ca854560637bc68`, v0.14.0, PR #490. Active custom-stickers Preview reserves v0.13.0.

## Current work
- Creator-owned canonical tasks with multiple invited friends, global completion, minimal shared projection, offline completion/membership queues, server-side friendship authorization/epoch, idempotence, revocation, and account-erasure/backup boundaries.
- Owner task replication merges independent edits; shared completion uses server transaction CAS and old-client owner baseline guard. Notifications suppress misleading creator-attributed shared completion.
- Appwrite migration 007 creates private indexed `task_shares`; 008 removes known Scratch broad friendship create grant **only** with explicit `--only` selection. Other migrations never auto-run 008.
- Creator Share sheet, recipient Explore invitation inbox and virtual Shared day-group. Unit/handler/DOM/browser regressions added. Earlier task SHA `f7aaed30` passed focused CI.
- Stable Preview first full check failed on TypeScript optional attempts narrowing in `src/lib/taskShareQueue.ts`, and checkpoint formatting/token budget. DOM/browser shards passed. Vercel build failed at same TS check. The follow-up branch `chatgpt/shared-tasks-ts-guard-repair` corrects the membership-queue guard missed in the first Preview repair.

## Cloud safety gate
Read-only Scratch `6a96e82d000d1310b3be` lacks `task_shares` and has legacy `friendships` permission `create("users")`. Current active Scratch Function must not be replaced until exact-source deployment and migrations are ready. The connected Console cannot run the required confirmed Git CLI migration and exact source-archive deployment; no Scratch or Production mutations were made.

## Next action
Pass repair focused CI; squash into stable Preview; inspect exact-SHA full canonical, size/PWA and Vercel READY; repair failures. Then execute confirmed Git-owned migration 008, 007 and Function activation on Scratch with scoped key/CLI, test three disposable accounts, offline/revocation/old-client and real device/browser flows. Keep issue open and do not promote to dev/main without explicit user acceptance.
