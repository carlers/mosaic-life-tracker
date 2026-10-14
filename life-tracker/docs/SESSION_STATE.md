# Session checkpoint

Updated: 2026-10-14 UTC
Current task: #708 emergency Preview regression: Scratch additive Diary message columns block older chat RxDB replication.

## Root-cause evidence
- User reports no chat histories or cross-account visibility on `fix/chat-reliability-708-integration-20261014@bf9f1e1786fc7b39c7bb3f29e9aa65223c1ecedc` even though tasks appear. PR #848 OPEN **UNMERGED**; `dev@881ae72...` unchanged. Pause promotion and do not run destructive message Sync/repair or backend rollback.
- Live Scratch `life_tracker.messages` read-only: 574 server rows; recent Oct 14 outgoing/incoming pairs are delivered, undeleted and have owner read permissions. User-scoped server query returns rows. No evidence of wholesale deletion. Active shared Scratch Function `6acd0a6643868c68508c` replaced previous #708 deployment `6accddcb...` but preserves #708 delivery/repair handlers in vetted Diary integration PR #752.
- Live backend migration 015 added 4 optional `diary_ref_*` columns to every messages row. Current `src/lib/syncMapping.ts` spreads EVERY remote column into RxDB, converts known fields but leaves the 4 new columns. Current `messagesSchema` lacks them, and RxDB forbids extra top-level document fields. A fresh Preview/origin receives rejected pulls, showing no history despite preserved server rows. Prior old Preview may have existing cached rows.
- Also exact new stable Vercel alias is not separately registered in Scratch Web platforms (only broad wildcard), so authenticated CORS/login remains a separate unresolved manual check; do not mistake hosted HTTP 200 for account acceptance.

## Narrow fix
- In `fromAppwriteFormat(..., 'messages')`, discard unknown server-only columns before mapping. Preserve known fields, ownership, direction, content and tombstones. Never mutate/delete remote fields or loosen RxDB schema. Newer Diary UI can explicitly map approved added fields when its own compatible schema ships. Add both incoming/outgoing regression fixtures including all live Diary fields and a future unknown field, assert resulting local shape exactly matches `messagesSchema.properties`.
- Candidate Preview version `0.24.2` patch (successful user-testable #708 refinement) in package/lock/appVersion. Keep all CI guard settings, #592, #784 and Scratch deployment unchanged.
- Quiet `chatgpt/708-diary-columns-compat-20261014` focused gate, squash into stable `fix/chat-reliability-708-integration-20261014` ONLY after focused success; then full canonical and Vercel READY, hosted routes, live user acceptance before PR #848 promotion. Previously accepted v0.24.1 stable full #38587857741 SUCCESS, Vercel `dpl_zCMK4eU6Dn1vT3N8uirYv5RdfDdS` READY; that earlier automated acceptance did NOT exercise live migration 015.
- No production/main/dev/Appwrite/data writes. #708 remains OPEN; report any browser/account checks not performed.

## Next action
- Re-run focused CI for the unchanged compatibility fix, then squash accepted task into stable Preview and complete exact-SHA canonical and hosted verification. Recheck authenticated two-account history and new sends before ever merging #848. Keep Scratch rows, Function, dev and Production unchanged.
