# Session checkpoint
Updated: 2026-10-28 Asia/Manila
Current task: #1027 post-AFTER R2 recovery hosted Supabase acceptance; **no release authorization**.

## Verified recovery state
- Isolated recovery source `feature/1027-supabase-recovery-20261020@f031bf7f2edbee920537cc535ada3427db2b26aa` (PR #1428 merged). Focused Quality #40670938911, canonical Quality #40671071596, and real synthetic encrypted fourteen-table/signed restore #40671071694 **SUCCESS**. Local real GoTrue #40671071874 and Settings restore #40671071582 SUCCESS. Protected Supabase Core App Preview deployment and real devices remain separately gated.
- **AFTER DR ACCEPTED** on immutable R2 `20261028T100954899Z`: source-pinned read-only ciphertext download, full age authentication, exact fourteen-table PostgreSQL/Auth restore into fresh loopback-only PG17, original-password GoTrue sign-in/owner lease/populated owner read and cross-owner denial, complete private-media and nonempty synthetic photo restore, disposable cleanup. Exact owner-returned marker `MOSAIC_R2_EXACT_SNAPSHOT_DISPOSABLE_RESTORE_PASS: 20261028T100954899Z`. Prior ten-table BEFORE generation `20261028T053525682Z` also independently restored. **Never recapture, republish, overwrite or prune either accepted generation.** Managed SMTP/OAuth/JWT and photo-bearing original source (if absent) are separate.
- Hosted Scratch `mosaic-dev` remains ACTIVE_HEALTHY PG17.11, 21 migrations, 87 Auth / fresh authorities / Mosaic accounts / provider mappings / audit entries, no orphan/missing bindings. Six personal tables RLS owner SELECT, no anonymous direct access or authenticated direct UPDATE/DELETE; four private registry tables deny browser table grants. All six personal Realtime publications and category retirement/atomic deletion guards present.
- **Zero** account consent markers, **zero** installation release markers, and final personal writer-fence migration `20261027183840_enforce_personal_writer_consent.sql` **not installed**. Nine signed SECURITY DEFINER advisor warnings need risk review and hosted negative tests; leaked-password protection is disabled. No hosted SQL/Auth/Storage writes or provider/source promotion in accepting recovery evidence.

## Remaining release gates
- Current 21-migration **hosted** signed two-owner disposable-account tests of category retirement/deletion, account registry/consent/readiness, RLS/CAS, lease/epoch, foreign-owner denial and verified cleanup. Older hosted six-domain tests and synthetic tests do not replace them.
- Controlled-mailbox hosted signup/confirmation/password-reset delivery, SMTP/redirect and limits/security acceptance; Auth Management inspection previously returned 401.
- Exact-SHA isolated protected Preview reviewer and real Android/iOS/web/offline/media/ZIP/account-switch/old-PWA acceptance; Appwrite old-writer/draft fencing and consented new-data versus verified historical import strategy.
- Only after separate owner consent, reviewed trusted release marker and signed cutoff authorization: final writer-fence migration. Then explicit protected `dev`, `main` and Production cutover approvals.

## Next action
Do connected read-only hosted/current CI security and Preview inspection, and prepare current-schema signed two-owner acceptance with marked disposable accounts only. **No new Fedora R2 backup or restore command is required.** Never infer deployment or Production approval from DR PASS.

Issue: https://github.com/carlers/mosaic-life-tracker/issues/1027
