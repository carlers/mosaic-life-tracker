# Session checkpoint
Updated: 2026-10-28 Asia/Manila
Current task: #1027 isolated v0.48.0 Supabase personal candidate; finish media and enforce server consent/readiness.

## Boundaries
- Baseline recovery ababddcee968df3a815b36d96a9d097991c47938. Only isolated recovery merges are authorized. No dev/main merge, Production release, protected self-approval, real-user import or Appwrite mutation. Preserve the dirty secondary worktree.
- Appwrite return is not a prerequisite. Fresh/recovery-pending new data stays separate from historical authority. Never link by email or declare unavailable history migrated. Preserve original archives/local drafts and tombstones.

## Delivered
- #1408 registry merged at 5de24775; focused 40550132132, signed UI 40550173355, fourteen-table restore 40550170847 and canonical 40551505375 PASS.
- #1409 six-domain Auth/sync lifecycle merged at 5e1193c37033aa45081bf6b0fe4e2e14ed293443. Focused 40557260571, signed UI 40557259053, canonical 40558971752 and all recovery labs PASS. Stable Core App 40558972054 core/artifact PASS; protected Preview WAITING.
- #1410 backup/media merged at 367e610011a8468dfd28e6368ba2be8c390be9c5. Focused 40561697417 and signed Core App 40561697359 PASS: offline reload/exact ZIP bytes, actual ZIP media import, task/Diary second-device photos and six-domain lifecycle. Backup v5 retains IDs/tombstones/drafts/retirement, guards owner changes and preserves newer edits. Mounted photos retry when verified authority arrives.
- #1411 completes fourteen-table recovery wrappers and rejects JSON-null release proof. Restore 40560053830 PASS before the next change. New migration gates raw six-domain INSERT/CAS and photo INSERT/DELETE on complete consent, active mapping, release evidence and live lease. Owner export remains readable. Signed denial/success/released-lease probes and registry-aware source/restore fixtures cover this contract; no hosted installation. Local syntax/lint, eight wrapper tests and contracts PASS. Focused 40562405002 caught checkpoint size; shortened here without relaxing its limit.

## Next action and blockers
- Finish #1411 signed authority, focused gate and stable canonical/artifact. Fourteen-table authority restore 40562405153 PASS; Core App 40562405059 found target validation ran before authority (409 instead of 403). Authority now runs first on all six tables; Settings validation checks enabled trigger functions/events rather than their old names. Require fresh signed SQL/restore proof. Operator photo probe requires already-consented accounts/readiness and signed leases; 14 photo/doc and eight wrapper tests PASS. Use fetched exact recovery SHA, not stale origin refs.
- Hosted mosaic-dev lacks registry/readiness/writer-fence and category additions. Before activation: trusted rollback snapshot, reviewed additive rollout, registry-bearing encrypted backup/restore, changed signed hosted proof and protected Preview/device acceptance. Existing seven-table Fedora/R2 proof remains valid only for its original schema; do not repeat accepted drills.
- Auth Management inspection returns 401. Brevo relay/account exists, but Supabase SMTP configuration and actual delivery remain unverified; password protection/privileged-RPC review remain open. #1406 verified historical claim/import requires trusted owner evidence; no public linking API exists.
- Local PostgreSQL image unpack exhausted Docker space; use disposable CI for real SQL/Auth/Storage. New offline photo uploads are unsupported; cached owner photos export locally. See MOSAIC_ACCOUNT_IDENTITY.md, BACKUP_RESTORE.md and SUPABASE_PRIVILEGED_CAS_REVIEW.md for contracts.
