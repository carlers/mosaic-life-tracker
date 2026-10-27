# Session checkpoint
Updated: 2026-10-28 Asia/Manila
Current task: #1027 six-domain personal app lifecycle after #1406 independent account start, isolated v0.48.0 candidate.

## Baseline and boundaries
- Started from verified recovery `ababddcee968df3a815b36d96a9d097991c47938`. Live full canonical #40541852789, signed GoTrue #40541852559, Settings #40541852713 and Bucket #40541852967 PASS. Core App #40541852557 core-app and hosted-preview-artifact PASS; preview-deploy WAITING for protected approval. Prior owner-tested Preview remains unchanged.
- Work continues only on isolated recovery. No dev/main merge, Production release, real-user import, Appwrite mutation or protected self-approval. Existing dirty secondary worktree is preserved. Appwrite return is not a launch prerequisite; historical source stays non-authoritative and unresolved history remains pending.

## Changes and checks
- PR #1408 merged to recovery at `5de24775e3bc767fb3a721c345cddb17ca4be61b`. Task focused #40550132132, signed Core App #40550173355 and fourteen-table encrypted exact-copy restore #40550170847 PASS. Stable full canonical #40551505375 PASS; remaining signed labs are still being checked. No protected approval was performed.
- Private versioned Mosaic/provider/installation mapping and audit preserve existing server-issued canonical IDs. Signed self lookup rejects unknown/revoked/foreign associations; no email/metadata linking or public historical claim API. New-data choice is explicit before app writers, with durable fresh/recovery-pending consent and no pending-to-fresh downgrade.
- Owner mutation, Auth/registry and account-start focused tests, typecheck, lint and build passed. Owner/identity collisions fail closed; advisory size warnings remain.
- Registry snapshots require fourteen-table exact-copy restore, preserving mapping/audit/installation but excluding sessions and leases. Older profiles reject registry-bearing archives.
- Personal app now connects all six domains to Auth, refresh/logout, conflicts, offline mutation, Realtime wake and Sync Now. Portable preferences are isolated, ZIP Merge routes supported domains, and the Preview artifact selects personal. Protected server readiness defaults off and cannot be granted by a browser flag. Fresh/pending new-data proof is explicitly separate from historical migration escrow. Targeted lifecycle/authority/preferences 62 tests and related restore/artifact/capability 71 tests passed; default and personal builds pass blocking budgets. New signed six-domain browser scenario is awaiting CI.

## Next action
- Six-domain task `a716c4c1` focused #40552537724 and fourteen-table restore #40552576290 PASS. Core App #40552574190 stopped before its personal browser scenario: synthetic one-digit run IDs violated the release-evidence shape. Corrected the local fixture to valid synthetic run IDs; real SQL/security gates stay unchanged. Rerun signed UI before merging PR #1409.
- Signed UI #40554117462 exposed link-before-target ordering. Pending targets now retry without conflict parking; foreign/deleted/invalid targets remain blocked. Regression 25 tests pass; rerun signed UI before merge.
- Signed #40555792395 now passes link creation, two-device/offline convergence, portable preference, unlink and achievement; final logout clicked during cold-start Auth recovery. Browser now waits for signed Online and navigates to Settings without reloading, matching the existing logout contract.
- Run task focused CI, signed Core App registry/UI lab and fourteen-table encrypted restore; fix failures, then squash into recovery and require full exact-SHA canonical acceptance. Hosted schema/advisor/backup rollout and protected Preview require their gates before deploying these application bytes.
- Continue signed six-domain UI acceptance, complete ZIP tombstone/history preservation, photo/offline/device acceptance, trusted historical-owner recovery, SMTP/privacy audit and release packet. #1406 is partially implemented, not closed: trusted recovered-owner claim/import remains absent. See MOSAIC_ACCOUNT_IDENTITY.md. No repeat Fedora/R2 historical drill is requested.
