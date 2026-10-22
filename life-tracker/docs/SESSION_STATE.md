# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 original private archive has passed count-only audit; core recovery target being independently exercised.

## Verified input and baseline
- Isolated feature/1027-supabase-recovery-20261020@8eee86b26bf72580ead5f43c67d500cea1548cdf: exact SHA full Quality Gate #39743201665 (one unrelated browser flake passed on rerun), signed Core App Lab #39743201666, synthetic encrypted restore #39743201699 and real GoTrue restore #39743201664 all SUCCESS.
- Owner independently ran Fedora-only count auditor on age-encrypted 2026-10-22 snapshot. 54 DATA objects decoded, 1410 total rows and zero restores. Six core: auth.users=81, identities=81, core_authorities=81, owner_revisions=49, categories=53, tasks=58; matches earlier read-only hosted counts exactly.
- Additional archived Mosaic data: beta_signup_invitations=2, core_sessions=150, legacy owner_revision, public mosaic_poc_items and mosaic_sync_probe=0. Auth: 27 data tables with sessions=184, refresh_tokens=226, mfa_amr_claims=184, one_time_tokens=3 and schema_migrations=82, all other Auth DATA tables empty except users/identities. Storage: only migrations=74; Realtime migrations=91; supabase_migrations schema_migrations=11. Original encrypted archive/key stay on user Fedora machine.
- Hosted mosaic-dev nonempty (81 users incl 3 unmarked), Diary and retirement not migrated. No hosted schema/Auth/SMTP/public signup writes, no dev/main/Production changes.

## Task
- Create a guarded local-only recovery into a freshly initialized, random disposable PG17 Supabase CLI Docker stack, separate from existing Fedora local postgres:25077. Restore only six core TABLE DATA objects, never import old sessions/tokens or raw managed DDL, preserve archival invitation/leases in original age backup, verify exact source/target per-row COPY equality and counts plus canonical authority integrity.
- Share no secrets, archived rows or user IDs; require Unix-socket Docker daemon, loopback-only published ports, recognized unique new DB container, archive SHA, empty target, expected counts, in-memory archive staging and cleanup. Integrate exact helper in generated real GoTrue CI, document scope. No app version impact or hosted writes.

## Next action
- Verify focused Quality Gate and real GoTrue CI after implementation; repair failures and add dedicated wrapper self-check if needed, squash only to isolated recovery feature, verify exact-SHA four labs.
- Owner then runs vetted Fedora script per supabase-poc/PRIVATE_CORE_RECOVERY.md. Share only sanitized final status and anonymous local target diagnostics, not credentials, age archive/key or data.
- Even a six-table recovery pass does not certify historical invitations, current hosted delta, federated Auth, SMTP or real signed multi-owner acceptance. Continue issue #1027/#1029/#857; do not promote dev/main/Production without separately required explicit approvals.
