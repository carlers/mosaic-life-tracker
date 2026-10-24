# Session checkpoint

Updated: 2026-10-24 UTC
Current task: #1027 source-only encrypted private Storage inventory snapshot foundation; #1029 Diary/media dependencies.

## Verified baseline
- Isolated stable `feature/1027-supabase-recovery-20261020@3445d208635378766d1942d552ce59eed56a09d2` (v0.47.0). Quality #40084152785, Synthetic Restore #40084152762, Real GoTrue Restore #40084152766 SUCCESS; Core App #40084152763 awaits protected Preview approval. Neither `dev`, `main`, Production nor a public alias was promoted here.
- The operator's encrypted fresh snapshot restored 410 exact rows in seven allowlisted tables to private local PG17. Original-password GoTrue login, owner lease, populated owner read and cross-owner denial all PASS. Old writer leases/tokens excluded. This is scoped core/Diary row DR, not managed Supabase Auth, SMTP or media recovery.
- Isolated hosted Scratch `mosaic-dev` has private 5 MiB WebP Storage bucket `mosaic-personal-photos`, signed owner-only SELECT/INSERT/DELETE, immutable objects and Diary photo CAS. The first signed hosted test passed five positive and negative owner/security/encrypted binary checks but failed its final cleanup. The repaired, owner-only `--cleanup-20261024-probe` in merged PR #1290 is CI-accepted. A live read-only SQL check still shows exactly one original synthetic fixture from 2026-10-24 09:44 UTC. **Photo acceptance remains blocked** until the original owner runs the one-time signed cleanup and the provider confirms zero Storage objects. Never SQL-delete Storage metadata, replay full two-owner test or repeat the private DB backup/restore.
- Fedora keeps the existing `~/.config/mosaic/supabase-pooler.env` and `~/.config/mosaic/supabase-backup.agekey`. Do not ask for either again or publish local credentials, real rows, account identifiers or photo contents.

## Current task scope
- `chatgpt/1027-storage-encrypted-snapshot-foundation-20261024` adds only the read-only `supabase-poc/private-photo-snapshot.py`, `supabase-poc/PRIVATE_MEDIA_DR.md` and offline six-case unit/Vitest wrapper. The tool lists bounded all-owner files under the fixed Scratch private bucket, downloads WebP binary contents using an explicitly supplied backend-only private Storage key, checks a second inventory, streams an age-encrypted tar and SHA-256 manifest to a private directory, independently decrypts and validates every byte and publishes with no-clobber. No hosted key is read from management services or committed to Git.
- This is a **source-only DR foundation** with version impact NONE, not an executed hosted snapshot, scheduled retention, separate-target recovery, complete Auth/SMTP backup, production cutover, or approval of photo uploads. Future privileged runner/operator access must be separately provisioned and vetted. No cloud writes for this task.

## Next action
- Land the coherent task checkpoint with `[verify:focused]`; inspect task CI and fix any failures, then squash a reviewable PR to the isolated stable branch and verify exact-source Quality/Restore/Core App checks. Do not bypass protected Preview review.
- Operator's only pending authenticated action is one Git-pinned `--cleanup-20261024-probe` with the original **first hosted test owner**, credentials entered privately on Fedora. Require `HOSTED_PRIVATE_PHOTO_LEFTOVER_CLEANUP_PASS` and independent live object count zero; do not use an administrator SQL delete.
- Subsequent implementation: protected scheduled full-bucket encrypted snapshots/retention, independently verified nonempty target restore, Auth/platform config and live-device/drift acceptance, personal Bucket List/settings parity, then old-client Appwrite writer fence/provider reversible migration. No `dev`/`main`/Production change without required approval.
