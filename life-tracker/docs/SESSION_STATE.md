# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 offline encrypted Appwrite exact-grant rollback escrow, branch `chatgpt/1027-appwrite-acl-archive-fullcheck-20261026`.

## Accepted / approvals
- Production stays Appwrite. `main` bef14fb791a361e8c1f902a5c4adf4536e57aae7 and `dev` 497919bed4b6ce85b826f2d86fc767920344ec17 unchanged; no hosted Supabase Bucket/Settings schema, Production, SMTP alerts/pruning, R2 user data or social changes.
- Historic real seven-table Scratch age/R2 snapshot 20261025T031343499Z restored on Fedora with native >=30-day lock confirmed. Do not repeat. User demands ONE final SHA-pinned consolidated Fedora command covering all pre-social features once automated code and verification are ready.
- Isolated recovery `101764992c764f79cbd74ca6f5811f6cd8b27f6c`: accepted signed owner-private Bucket/link SQL #1328, ten-table PG17 age restore #1329, signed Bucket CAS #1330, native owner RxDB #1333, history/quarantine #1334-35, Appwrite owner history/full content/7-domain joins #1337/#1340/#1341, independent age readback #1338, replay parity #1339, historical photo bytes parity #1342, old-PWA permissions preflight #1344, GET-only admin readback #1346. All SOURCE-ONLY and inactive.
- #1346 full-diff focused Quality #40266941969 passed eight tests. Stable `10176499`: Quality #40267082200, eight-table #40267082156, ten-table #40267082165, real GoTrue #40267082243, synthetic #40267082179 and history age #40267082161 PASS. Core App technical done, hosted Preview waiting for separately approved protected stage.
- Connected Appwrite disposable Scratch project `6a96e82d000d1310b3be` is PAUSED; its data/Storage/Function APIs return project_paused HTTP 403. No resume or Appwrite user record access authorized/performed.

## Current task
- `supabase-poc/appwrite-acl-rollback-archive.mjs`: accepts exact previously audited complete owner+table+bucket/file+Functions ACL snapshot from signed GET-only scanner; rechecks SHA/counts/full fields, copies sealed original permission graph before async I/O, encrypts age X25519 in private 0700 dir to atomic exclusive 0600 ciphertext with no plaintext disk, logs or overwrite.
- Independent age verifier requires pinned ciphertext, decrypted manifest, admin readback and server-source witness SHA, owner and Appwrite installation; revalidates original ACLs, count/foreign/duplicate guards and returns only sanitized metadata. No script applies any rollback or mints authority.
- Dedicated disposable real-age encryption workflow `.github/workflows/appwrite-acl-rollback-encryption.yml`, negative/roundtrip synthetic lab `tests/appwrite-acl-rollback-age-lab.mjs`, docs added. First task #1347 focused/age CI stopped on a synthetic test syntax typo; replacement full-diff corrected and CI NOT YET VERIFIED. Result always `sourceLeaseAuthenticated:false`, `aclRestoreAuthorized:false`, `providerCutoverEligible:false`.

## Next action
- Full-diff task focused Quality + dedicated real-age lab, repair, squash to isolated recovery only after green, verify canonical labs. Never self-approve protected Preview or install hosted schema.
- Next true blockers: independently server-issued exclusive source writer lease and admin key/Function fence; reversible real Scratch ACL freeze with old installed PWA HTTP 403 probes and offline-outbox safety; authenticated complete seven-domain/photo-byte source age/R2 archive + exact replay to Supabase and back, Settings/Bucket two-device/offline/ZIP parity, 10-table PostgreSQL/Auth/Storage R2 DR. Only then single Fedora operator acceptance; Production requires explicit approval.
