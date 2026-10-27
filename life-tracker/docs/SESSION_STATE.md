# Session checkpoint
Updated: 2026-10-28 Asia/Manila
Current task: #1027 complete registry-aware recovery entrypoints after personal backup, isolated v0.48.0 candidate.

## Baseline and boundaries
- Started from verified recovery `ababddcee968df3a815b36d96a9d097991c47938`. Live full canonical #40541852789, signed GoTrue #40541852559, Settings #40541852713 and Bucket #40541852967 PASS. Core App #40541852557 core-app and hosted-preview-artifact PASS; preview-deploy WAITING for protected approval. Prior owner-tested Preview remains unchanged.
- Work continues only on isolated recovery. No dev/main merge, Production release, real-user import, Appwrite mutation or protected self-approval. Existing dirty secondary worktree is preserved. Appwrite return is not a launch prerequisite; historical source stays non-authoritative and unresolved history remains pending.

## Changes and checks
- PR #1408 merged to recovery `5de24775e3bc767fb3a721c345cddb17ca4be61b`. Focused #40550132132, signed UI #40550173355, fourteen-table encrypted restore #40550170847 and stable canonical #40551505375 PASS.
- #1406 private installation/Mosaic/provider mapping and audit preserve canonical IDs. Signed self lookup rejects unknown/revoked/foreign associations. Fresh/recovery-pending consent is explicit; no email matching, historical claim API or pending-to-fresh downgrade. See MOSAIC_ACCOUNT_IDENTITY.md.
- PR #1409 connects Auth, refresh/logout, conflicts, Realtime and Sync Now to all six personal domains. Portable Settings are isolated; Diary/media remain private. Server readiness defaults off. Task focused #40552537724 and fourteen-table restore #40552576290 PASS. Signed UI exposed synthetic fixture validation then a link-before-target race; repairs are running.
- Version 5 backups retain tombstones, same-owner IDs, retirement, drafts and available photo bytes. Invalid history/missing references fail before writes; newer local changes win. Offline cached identity reads only cached own photos. Export/mutation guards reject account changes, including A→B→A. Historical Settings/link/Diary IDs remain editable.
- Backup/media/restore 68 and owner-hook 28 focused tests pass; typecheck and changed-source lint pass. Signed offline cold-reload ZIP byte comparison awaits CI. Local snapshots are not complete server escrow or verified legacy ownership.
- Read-only mosaic-dev audit: healthy, missing registry/readiness and category-retirement/atomic-delete migrations. Seven privileged-RPC and disabled leaked-password warnings require review. Auth-config read returned HTTP 401; SMTP remains unverified. No hosted write or protected approval.

- Recovery entrypoint review found R2 restore still enumerated only 7/8/10 profiles despite the new fourteen-table marker. Both trusted-machine wrappers now select explicit fourteen-table flags/parity and clear inherited registry grants; old evidence/defaults remain intact. Offline stage/cleanup/profile mismatch regressions cover the real wrapper paths. No new owner run or backup is requested.

## Next action
- #1409 merged at `5e1193c37033aa45081bf6b0fe4e2e14ed293443`: task focused #40557260571 and real signed UI #40557259053 PASS; stable canonical #40558971752 running. Backup focused #40557678499 PASS; signed #40557678467 confirms offline ZIP bytes but failed import/task-photo checks. Repairs preserve validated original WebP bytes, recognize typed Storage 400/404 missing-object envelopes, and wait for signed readiness before upload/import. Require new signed evidence before #1410 merge.
- Complete trusted historical-owner recovery, SMTP/security/hosted rollout and device acceptance before release. #1406 remains partial: no verified recovered-owner claim/import. Protected Preview requires hosted schema/security/backup gates; no dev/main promotion or self-approval.
- Reuse accepted Fedora/R2 proof where unchanged. Local PostgreSQL image unpack failed for disk space; use disposable CI for changed signed SQL/restore proof. Existing dirty secondary worktree remains untouched.
