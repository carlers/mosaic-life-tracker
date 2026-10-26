# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 source-only signed full-content Appwrite personal readback, isolated task branch `chatgpt/1027-appwrite-personal-source-20261026`.

## Accepted and protected
- Appwrite Production and `dev`/`main` untouched; verified Git main `bef14fb791a361e8c1f902a5c4adf4536e57aae7`, dev `497919bed4b6ce85b826f2d86fc767920344ec17`. Hosted Supabase Bucket/Settings SQL UNAPPLIED, no live writer, provider switch, social, Brevo alert/prune, R2 user write or Production deployment.
- Real seven-table historical Scratch R2 age backup 20261025T031343499Z restored on Fedora with >=30-day R2 retention verified. No more piecemeal workstation tasks: owner requires ONE bundled SHA-pinned final pre-social migration/DR acceptance command after all prerequisites.
- Isolated recovery `9356c11136f05e5365505529454d9b44dd779bce` accepted signed Bucket owner SQL #1328, ten-table encrypted PG17 restore #1329, signed Bucket CAS/pull #1330, isolated Bucket/link RxDB #1333, historical task-link quarantine classifier #1334, encrypted history writer #1335, signed Appwrite three-domain identity/link reader #1337, offline independent age decrypt #1338, and source↔target Bucket replay-parity #1339. All remain source-only. #1339 task full-diff focused #40255316043 PASS (9 tests).
- Exact recovery `9356c11`: Quality #40255452165, synthetic #40255452243, eight-table #40255452148, ten-table #40255452170, GoTrue #40255452169, history age #40255452198 ALL PASS. Core App technical jobs separately; protected Preview step waiting for approval. No hosted Supabase cutover.

## Current source-only task
- Add `supabase-poc/appwritePersonalSourceRead.ts`: frozen signed full *raw owner-content* scan for tasks/categories/Diary/settings, including deleted rows and optional/unsupported settings, original image/photo references, timestamps and permissions. Depends on server-authoritative **seven-domain** counts and exact Cloud/Oracle installation-bound exclusive writer-freeze lease; checks account, session epoch and lease before+after every page over two passes. Requires monotonic owner-only keyset pagination; rejects foreign/unknown/partial/drifting/malformed records, no synthesized defaults, bounded in-memory result.
- Add `tests/unit/supabaseAppwritePersonalSourceRead.test.ts` for positive field/tombstone/permission preservation, cross-pass mutation, frozen counts, foreign/account/lease switch, partial/duplicate/unknown/oversized fields; docs in `CORE_MVP_PROVIDER_RETURN.md`. CI **not yet verified**, no live backend calls or app writer.
- Result is a PRELIMINARY in-memory readback only, `completeSourceArchive:false`. No actual server freeze issuer, full signed encrypted source content, Storage photo-byte capture, consistent join to three-domain link reader, import, source auth provenance or reverse migration yet.

## Next action
- Run exact full-diff task focused Quality, repair and squash to isolated recovery if green; verify stable canonical technical jobs and no protected Preview promotion.
- Implement real server-enforced exclusive writer lease and full authenticated owner/source/Storage bytes + encrypted source archive and replay parity, then Settings/Bucket offline cross-device sync, ZIP/media and provider fencing, bidirectional Appwrite Cloud/Oracle↔Supabase dry run, real ten-table PG17/Auth/Storage offsite DR. ONE final Fedora acceptance; all Production actions separately approved.
