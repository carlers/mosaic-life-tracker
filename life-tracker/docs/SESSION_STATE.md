# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 isolated Bucket/link source versus target replay parity contract, task branch `chatgpt/1027-bucket-replay-compare-20261026`.

## Accepted/protected
- Appwrite remains Production. Git `main` bef14fb791a361e8c1f902a5c4adf4536e57aae7 and `dev` 497919bed4b6ce85b826f2d86fc767920344ec17 unchanged; hosted Supabase Settings/Bucket SQL UNAPPLIED; no live writer, provider cutover, SMTP/alerts, pruning, social or actual R2 user mutation.
- Real historical seven-table Scratch R2 age archive 20261025T031343499Z restored on Fedora with native >=30-day retention readback. Owner requires no piecemeal Fedora runs; next trusted workstation invocation ONE final all-pre-social migration/DR acceptance command.
- Isolated recovery `69281974f459c76cde52d83b99d5fb6d91396ea7`: accepted private Bucket SQL #1328, ten-table encrypted PG17/GoTrue DR #1329, signed read/create/CAS #1330, isolated Bucket/link RxDB #1333, full owner-link source quarantine classifier #1334, offline age encrypted ledger #1335, source owner Appwrite two-pass signed reader #1337 and independently pinned offline age decrypt/owner-history verification #1338. All source-only.
- #1337 full-diff focused Quality #40254080629 passed 11 new owner-history tests; stable `47046083` Quality #40254253091 passed. #1338 focused Quality #40254768480, real age encryption/decryption #40254768481 passed; stable `69281974` age lab #40254879494 and synthetic #40254879474 passed, other canonical/DR jobs running at checkpoint. Protected hosted Preview still approval-gated.

## Current work
- `candidateBucketReplayParity.ts` source-only exact replay comparator: validates independent owner full source manifest digest and expected counts, requires all Bucket goals + admissible ready/tombstone links to match mapped candidate SQL rows exactly, rejects foreign/extra/duplicate/missing/altered/revisionless target rows. Quarantined long/dangling/deleted-target links must remain in encrypted source ledger and absent from live target table.
- `tests/unit/supabaseCandidateBucketReplayParity.test.ts`: negative identity, tombstone, timestamp, link ref, revision, count, extra/quarantined target and source-pin cases. No backend calls or deployment. Focused Quality not yet verified. Output deliberately `providerCutoverEligible:false`.

## Next action
- Run exact SHA full-diff focused Quality on this task; repair then squash isolated recovery only when green, re-run canonical technical jobs and protected Preview gate without unapproved hosted deployment.
- Finish live trusted SERVER-exclusive writer/old-PWA fencing, independently complete source task/category/Diary/Settings history plus media, immutable owner-mapping/backfill/ZIP and two-device sync, signed target read, actual encrypted ten-table R2/Storage DR and reversible Appwrite Cloud/Oracle ↔ Supabase writer switching. Only then ONE consolidated Fedora acceptance; Production migration needs explicit approval.
