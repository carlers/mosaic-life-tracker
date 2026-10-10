# Session checkpoint

Updated: 2026-10-10
Current task: Implement GitHub issue #406 shared tasks (creator-owned, global completion, multiple invited friends, minimal fields, durable offline queue).
Source: `dev` `224f8a700f35bbe3853206ee208e1dc103ece5b3` (v0.12.1).
Stable Preview branch: `feature/shared-tasks` v0.14.0, current head `203a6476a386c8c2dacef0424d200bc1b0233c13` before size-review repair. Custom-stickers Preview reserves v0.13.0. No dev/main promotion.

## Current work
- Server-only `task_shares` with Function-owned invitation/membership, accepted-friendship epoch, revocation, minimal read DTO, and idempotent transaction-based global completion. No recipient-owned task clone.
- Client Share BottomSheet, received invitations in Explore and virtual Shared Day View group. Durable per-account offline member/completion queues, terminal failure feedback, and account cleanup.
- Owner RxDB merges independent title/date edits and rejects stale completion conflicts. Modern owner CAS carries completion precondition; legacy writes to previously shared tasks are fenced. Shared-task alerts are suppressed instead of misattributed.
- Managed schema migration 007, opt-in security migration 008 for legacy Scratch friendship create permission; 008 excluded from default and Preview automatic migration runner. Server/queue/sync/unit/DOM/browser regressions included.
- Focused CI for feature and both strict-TypeScript repairs passed; stable Preview browser/DOM and project checks passed. PWA output valid. Remaining full-build failure is a measured release-size ceiling, not TypeScript: after moving share queue out of AuthProvider eager imports, Vercel showed entry 441,671 B raw / 131,341 B gzip, initial closure 144,049 B gzip (+349 against old), Home 353,377 B gzip, aggregate 2,345,145 B raw / 722,374 B gzip and precache 2,428,484 B.
- Next scoped change: documented measured v0.14.0 allowance only for initial + aggregate/precache metrics with ~0.8–1.4KB provider headroom; entry and Home ceilings unchanged, all seven metrics still guarded and tests updated. This is not Preview acceptance until full CI and Vercel READY.

## Cloud readiness blocker
Scratch project `6a96e82d000d1310b3be` is missing `task_shares`, and `friendships` has legacy `create("users")` permission. No Appwrite mutation performed. The repository requires a confirmed Git CLI migration with a scoped Scratch API key, followed by exact-SHA source-archive Function READY/activation. Connected Console access cannot substitute for that documented execution. Do not touch Production.

## Next action
Run focused checks for the size-review task; squash into stable Preview and complete canonical + Vercel build/size/PWA/browser gates. Then apply explicit-only Scratch 008 and additive 007 through confirmed Git CLI with the needed credentials, activate reviewed Function, and run 3-account privacy/reconnect/old-client/erasure tests. Keep #406 open; dev/main require explicit user approval.
