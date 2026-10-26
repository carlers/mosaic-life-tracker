# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 isolated Appwrite old-client direct-writer cutoff preflight, task branch `chatgpt/1027-appwrite-writer-freeze-audit-20261026`.

## Accepted / protected
- Production Appwrite Git `main` bef14fb791a361e8c1f902a5c4adf4536e57aae7 and `dev` 497919bed4b6ce85b826f2d86fc767920344ec17 unchanged. Hosted private Supabase Settings/Bucket SQL UNAPPLIED, no live writer/provider switch, social, SMTP alerts/prune, media R2 mutation or user-data changes.
- Real Scratch seven-table 20261025T031343499Z encrypted R2 archive restored on Fedora with >=30-day native retention. Next Fedora operator action must be ONE final consolidated pre-social migration+DR acceptance, not repeating prior tests.
- Isolated recovery `0b44935364c3025bac759b10c4a340f5d4824595` includes signed Bucket/link SQL #1328, ten-table age/PG17 restore #1329, signed transport #1330, isolated RxDB #1333, full historical quarantine #1334-35, frozen Appwrite owner identity+content snapshots #1337/#1340/#1341, independent age readback #1338, source/target Bucket parity #1339, historical photo original/target byte audit #1342. ALL source-only. #1342 task focused Quality #40262253640 PASSED nine tests. Stable Quality #40262393940, history age #40262393902, synthetic #40262393739 PASS; eight-/ten-table, GoTrue, Core App technical/protected Preview status require later exact readback. No approved Preview promotion.

## Current source-only task
- Administrative `appwriteWriterFreezePreflight.ts`: checks owner-private Appwrite six TablesDB table grants, row ACL inventory, task_images bucket/file ACLs, independent owner row counts, all enabled write-capable Functions, and all 21 signed owner old-client create/update/delete HTTP 403 receipt slots. Refuses the manifest's existing `create("users")` and surviving row/file update/delete grants, missing/foreign rows, stale leases, alternate source targets and privileged bypass Functions. No backend/credentials accessed or revoked; deterministic audit fingerprint only.
- `tests/unit/supabaseAppwriteWriterFreezePreflight.test.ts`: positive hypothetical ACL freeze, production-style table creates, row updates, bucket/File ACLs, privileged Function, counts and missing/401/foreign probe negatives. CI NOT YET VERIFIED. Result always `serverFreezeAuthorityAuthenticated:false`, `privilegedWriterCredentialsRevoked:false`, `providerCutoverEligible:false`.
- Actual **server-issued** exclusive lease, encrypted reversible ACL rollback, old-PWA stale queued-write preservation, Function/admin credential fencing and disposable signed real-403 validation remain unimplemented, before any provider migration.

## Next action
- Full-diff task focused Quality and safe squash to isolated recovery only on success; full canonical gate. No protected Preview approval.
- Implement trusted admin-enforced ACL freeze/rollback and signer, authenticated full owner Storage/content/ZIP migration and target replay, offline cross-device sync, reversible Appwrite Cloud/Oracle ↔ Supabase exclusive writer switch and actual encrypted ten-table PostgreSQL/Auth/Storage R2 DR. One Fedora batch only after full automatic prerequisites; Production separately approved.
