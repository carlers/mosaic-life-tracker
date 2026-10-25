# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 ten-table Supabase personal DR acceptance, before Bucket/Settings provider rollout.

## Accepted and protected
- Production Appwrite `main` and `dev` remain unchanged by this work. No hosted Supabase Bucket/Settings schema, app writer, automatic alerts/pruning, or social cutover.
- Real historical seven-table encrypted Scratch R2 backup 20261025T031343499Z independently verified/restored on Fedora, with native >=30-day retention lock. DO NOT repeat Fedora until one final complete pre-social command.
- Prior disposable eight-table Settings/GoTrue/PG17 exact restore CI accepted; cannot substitute for ten-table or hosted backup.
- PR #1328 SQL/RLS/CAS + signed two-owner GoTrue Core App passed Quality #40216685875 and Core #40216685860, then **squash-merged only to isolated feature/1027 recovery** at `088d280de7ae059042603390164ea18d446306d3`.

## Current isolated stack
- Draft PR #1329 (task branch `chatgpt/1027-ten-table-disposable-restore-20261025`): explicit SHA-pinned ten-table profile, strict old-mode rejection, full-byte age/PG17 TOC and exact COPY byte/count independent restore, original-password signed owner and tombstone readback.
- #1329 earlier SHA `7eecc83ea700fa36bd34fb67615abbbb885df07e`: Quality #40217835511 PASS; ten-table lab #40217835594 FAIL before DB on TOC-order-dependent rejection.
- Fixed parser to inspect all unexpected private TABLE DATA before mode-specific refusal; added 16th ordered-manifest regression. Actual ten-table lab #40219350564 **PASS** at `1ae142fe801f55484490f93702df40bd2f872c31`. That SHA's focused Quality #40219350546 FAIL **only** because this checkpoint made the default handoff 3124 > 3000 token budget; this edit compresses checkpoint, not the security/recovery implementation.
- Draft PR #1330 (task branch `chatgpt/1027-bucket-signed-read-20261025`): source-only owner-authenticated Bucket/link incremental pull, no-upsert create/master, CAS, bigint checkpoints, account-switch protection, strict original reference IDs and preserved tombstones. Earlier focused Quality #40218135814 PASS at `006493151f63964b5d6361934e442e2045df12d0`; later source changes require exact final checks.
- Source-only task branch reconciliation #1331/#1332 already brought owner-first foreign-target SQL guard through #1329/#1330. No Product/Production writer activation.

## Next action
- Verify this condensed-checkpoint #1329 exact SHA focused Quality + actual ten-table CI, repair if needed; then squash #1329 to isolated recovery and confirm full canonical CI (do not apply hosted schema).
- Reconcile #1330 base against accepted recovery, run focused/contract tests and squash only after green. Then complete Bucket/Settings RxDB ownership checkpoints and persistent encrypted quarantine for long/missing/foreign links, full ZIP/photo/R2 Storage replay, fenced reversible Appwrite ↔ Supabase migration tests, one final consolidated Fedora acceptance.
- Hosted schema, Production/provider cutover, `dev`/`main` promotion, backup schedules/pruning, and 1.0 need separate explicit approval. Never claim unverified gates passed.
