# Session checkpoint

Updated: 2026-10-25 Asia/Manila
Current task: #1027 personal non-social Supabase Settings parity foundation, source-only.

## Accepted upstream state
- Appwrite Cloud is still Production main bef14fb791a361e8c1f902a5c4adf4536e57aae7, dev 497919bed4b6ce85b826f2d86fc767920344ec17. Supabase code is isolated on feature/1027-supabase-recovery-20261020.
- Real Scratch encrypted unified R2 DB/media snapshot 20261025T031343499Z uploaded, independently byte-watched, fully age-authenticated and recovered on Fedora into isolated PG17/GoTrue/Storage with owner isolation and synthetic media. All-future-prefix native Cloudflare 30d lock GET readback passed. Managed Auth/SMTP/escrow and real photo-bearing hosted-source DR remain separate.
- Main guarded Brevo failure-alert workflow exists, but automatic DR alerts, daily backups, and pruning remain disabled. Raw Proton sender mail invisible despite Brevo Delivered/open; Gmail rewritten Brevo managed From reached Proton. Owner requested Gmail-free managed Brevo From with Proton Reply-To and opened vendor support. Source-only Reply-To change merged through PR #1312 to isolated branch; main source not repinned or deployed.

## Current scoped task
- Add isolated candidateSettingsMapping.ts for full-fidelity opaque string Settings rows, explicit legacy owner↔Supabase UUID validation, preserved tombstones, and fail-closed rejected provider-specific profile image/friend carousel identities.
- Add migration 20261025_candidate_private_personal_settings.sql with RLS owner-only SELECT/INSERT and exact revision-checked CAS; this migration is UNAPPLIED and hosted data NOT modified. New Settings tables are NOT yet in encrypted backup/restore allowlists. Do not install until signed local PostgreSQL two-owner security and DR parity are proven.
- Unit mappings and Settings runbook/README index included; current follow-up adds disposable Core App Lab actual PostgreSQL Settings schema and signed two-owner CAS/RLS/lease tests. No app/public runtime or hosted schema changed.

## 2026-10-25 eight-table recovery allowlist extension
- Add explicitly SHA-pinned --fresh-personal-settings-sha256 for eight-table source/restore, with source Settings TABLE DATA required, disposable Settings schema/empty-target check and exact row-byte/owner/tombstone parity. Old six/seven historic restore remains accepted; a Settings-bearing source cannot silently pass in old mode. Nine no-network fail-closed tests and bash syntax gate added. Existing October 25 real R2 restore remains seven-table, NOT an eight-table proof.
- Still needed: real nonempty synthetic encrypted 8-table disposable CI restore and updated private Storage/DR acceptance; do not apply hosted Settings, enable writers, or request piecemeal Fedora commands.

## Next action
- Accept focused CI on a reviewed task branch, squash source-only to the isolated recovery branch after tests; verify canonical Quality and restoration labs. Next run synthetic eight-table age-backed restore/independent parity and signed Settings transport; no hosted SQL installation before recovery acceptance. No dev/main or Production promotion without new approval.

## 2026-10-25 owner directive: no more piecemeal Fedora commands until pre-social gate
- Owner explicitly requires NEXT Fedora request to be **one consolidated trusted-machine pre-social acceptance command** covering all then-outstanding personal features (tasks/categories/Diary/photos/Settings/BucketList/task links), encrypted full backup/reader verification/restore, signed owners, offline/ZIP imports, and both-direction Appwrite Cloud/Oracle↔Supabase provider return dry runs after autonomous CI preparation. Do not request new Fedora for individual Settings/DR fixes mid-development. Existing R2/Fedora and native lock successful proof should not be repeated. Private prompts once per credential; source-SHA pin, fail-closed resumable runner, complete teardown and stage markers. A second command only if fundamentally unavoidable.
- This is a future operator packaging requirement, not proof of completed parity, future Oracle availability, automatic provider migration, or live Production cutover authority; preserve manual device checks and separate protected release approvals. Full detail: docs/OPERATOR_ONEPASS.md and issue #1027 (2026-10-25 onepass directive).
- Recovery branch 7c51a1e39c5ec907dd32acd70a0ce1c05d60da31: signed Settings PostgreSQL/Auth step and core-app job passed; #40189952784 overall awaiting protected Preview deployment, not an acceptance of full hosted Settings or cutover.
