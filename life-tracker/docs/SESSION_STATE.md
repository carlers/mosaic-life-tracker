# Session checkpoint
Updated: 2026-10-28 Asia/Manila
Current task: #1027 post-registry hosted rollout safety/runbook correction on `chatgpt/1027-hosted-postregistry-runbook-20261028`.

## Verified recovery state
- Isolated recovery parent `feature/1027-supabase-recovery-20261020@f1dfbd1cf8251c1e71529ead790b8cd9e9e8ba35`; PR #1425 merged, full Quality #40660225092 SUCCESS. Protected `dev`/`main` and Production not changed.
- Hosted Scratch `mosaic-dev`: 21 migrations, 87 Auth users, fresh authorities, account mappings and audit events, zero missing/orphan mappings. Four registry tables have RLS and no direct browser table grants; three additional Realtime publications installed. No account consent, no installation release evidence and final writer-fence migration uninstalled.
- Ten-table encrypted R2 BEFORE `20261028T053525682Z` independently restored and accepted; preserve and never prune/repeat. Fourteen-table encrypted AFTER is NOT committed/restored.
- Owner R2-only differential: `MOSAIC_R2_READER_READ_CHECK_PASS`, `MOSAIC_R2_WRITER_READ_CHECK_HTTP_403_SIGNATURE_MISMATCH`, cleanup PASS. Cause within writer token/pair remains unverified; do not use another seven-credential full capture until both R2 read-only checks PASS.
- Security Advisor: 9 signed SECURITY DEFINER warnings (expected privileged APIs require independent review) and disabled leaked-password protection. Hosted SMTP password reset and protected Preview/device checks remain open. Final writer enforcement must not run while consent/evidence are unset.

## Scoped task / remaining verification
- Correct two stale rollout/security documents that incorrectly describe category and registry DDL as uninstalled. Clearly distinguish installed five additive migrations from the still-gated final writer fence, and record audited permissions, complete BEFORE recovery, writer-only SigV4 failure, AFTER DR/SMTP/Preview gates.
- Documentation/version impact NONE. Task commit requests `[verify:focused]`; after green, merge only into isolated recovery and require full canonical Quality Gate. No hosted writes, R2 mutation, privileged credential use or branch promotion.
- Owner next: create a correctly paired Object Read & Write S3 key ID/secret for `mosaic-supabase-backups` in Cloudflare, keep existing read-only pair, rerun only source-pinned R2 differential. If both PASS, run existing fourteen-table one-pass backup/watch/restore; only full `MOSAIC_FOURTEEN_R2_COMPLETE_OFFSITE_DISPOSABLE_RESTORE_PASS` closes AFTER DR.

Issue: https://github.com/carlers/mosaic-life-tracker/issues/1027
