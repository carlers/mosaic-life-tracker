# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 source-only encrypted owner-private Bucket/task-link historical ledger on `chatgpt/1027-history-encrypted-ledger-20261026`.

## Accepted source / protected boundaries
- Production remains Appwrite; `main`, `dev`, hosted Supabase Settings/Bucket SQL, live writers, alerts/pruning and user data unmodified.
- Historical real Scratch seven-table age/R2 20261025T031343499Z was restored on Fedora with native >=30-day retention verified. No more separate Fedora commands; only final onepass all-pre-social migration acceptance.
- Isolated recovery has merged #1328 signed private Bucket SQL, #1329 pinned ten-table PG17 age exact-byte independent restore, #1330 signed owner pull/create/CAS, #1333 native owner-fenced Bucket/link RxDB and #1334 complete owner-history quarantine classification. Last squash `8500a965467d09bdd2e21203956df6b8348bf3d2`. Prior task focused checks for each PR passed; all remain source-only.
- #1333 stable Quality #40249855225, Synthetic #40249855206, Eight-table #40249855195, Ten-table #40249855185 and GoTrue #40249855169 PASS. Core App technical #40249855168 PASS; hosted protected Preview deploy awaits separate approval. #1334 canonical checks on current recovery source are running and not yet accepted.

## Current work
- Deterministic `packOwnerBucketHistory` binds complete same-owner historical target/link classification to an independently authenticated encrypted full-source SHA pin, exact source counts and target identity digest. Source original 255-char task references, tombstones and missing/deleted targets are preserved. No undeclared fields exported.
- Offline `encrypted-owner-history.mjs`: real age X25519 encryption with plaintext only in memory, private 0600 output in owner-only 0700 dir, fsync, existing-destination no-overwrite and ciphertext SHA. Dedicated disposable test workflow checks synthetic exact decrypt, permissions, 255-char source and privacy failure cases. Earlier source SHA 5b95dbb3cff581bca9e3fe57116b89185b5f1c4d: Quality #40251164218 PASS and age lab #40251164202 PASS; later source security hardening requires final exact checks.
- Existing user ZIP remains active-only and is not an authenticated full-history provider migration source. No actual source archive extraction, R2 private-media backup, hosted writer, reverse replay or operational key escrow accepted.

## Next action
- Exact final task focused Quality + age lab; repair then squash into isolated recovery and verify full canonical gates. Do not auto-release protected hosted Preview or change Product/Production.
- Finish signed complete owner extraction and age provenance, encrypted ledger upload/retention and independent replay/hash validation; then photo/ZIP/Settings offline+device convergence, provider-exclusive writer fencing, reversible Appwrite Cloud/Oracle ↔ Supabase dry run, ten-table PostgreSQL/Auth/Storage R2 recovery. Deliver ONE consolidated SHA-pinned Fedora command after full pre-social bundle.
