# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 private Bucket List/task-link full-history classification, isolated task branch `chatgpt/1027-private-link-quarantine-20261026`.

## Accepted, protected
- Production remains Appwrite. No `dev`/`main` promotion, hosted Supabase private schema/writer, alerts/pruning, actual ten-table R2 media backup or provider cutover.
- Historical real seven-table Scratch R2 age snapshot 20261025T031343499Z restored on Fedora and native retention lock verified. Do NOT repeat workstation steps until ONE final all-pre-social migration and acceptance command.
- #1328 private Bucket/link SQL owner RLS/FK and signed GoTrue; #1329 ten-table PG17/age exact-archive restore; #1330 signed read/create/CAS all accepted into isolated feature/1027 recovery with exact synthetic/signed checks. Most recent PR #1333 adds strictly isolated Bucket/link RxDB native checkpoint, conflict reviews, tombstones and verified owner target inventory guards; task focused Quality #40249726273 SUCCESS, isolated recovery squash `6e3feb2fc5c47f0587e1ae1b2969b6f725576055`.
- Stable `6e3feb2` Quality #40249855225, Synthetic #40249855206, eight-table #40249855195, ten-table #40249855185 and GoTrue #40249855169 all SUCCESS. Core App technical job succeeded on prior stable SHA, latest workflow #40249855168 still completing protected artifact job at checkpoint. Do not claim Preview accepted.

## Current source-only work
- New `candidateBucketHistoryAudit.ts`: accepts complete externally verified one-owner task/Bucket/link identities and exact source counts, refuses foreign/duplicate/incomplete/invalid input. Classifies all historical links including soft tombstones and unrepresentable 255-char task references without dropping/reassigning them. No file IO, encryption, hosted data or app runtime activation.
- New ten-case unit fixture tests deterministic owner/privacy and quarantine boundaries. Focused CI **not yet verified**.
- Existing user ZIP export intentionally filters inactive/dangling links, and is NOT a full-history migration source. Next step is independent signed full-history extraction + cryptographically pinned encrypted owner quarantine, then exact replay/target-ID mapping.

## Next action
- Run exact focused Quality on current task; fix and squash to isolated recovery only after acceptance, then full stable canonical checks. No Preview deployment approval implied.
- Implement authenticated full-history/ZIP photo and storage parity, encrypted quarantine ledgers with source/hash replay, Settings/Bucket offline/device convergence and one-writer provider fencing, reversible Appwrite Cloud/Oracle ↔ Supabase migration dry-run and ten-table R2/Storage recovery. Give user only one final SHA-pinned Fedora pre-social command when fully bundled.
