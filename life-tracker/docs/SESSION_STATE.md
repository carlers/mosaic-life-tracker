# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 strengthen offline encrypted backup coverage validation before private recovery.

## Verified baseline
- Isolated Supabase branch feature/1027-supabase-recovery-20261020@9e920630dd421eeef92b697009e9cb7b9605ef86: full Quality Gate #39728421394, signed Core App Lab #39728421382, and Synthetic Restore Lab #39728421372 all SUCCESS.
- Independent disposable Vercel Sandbox synthetic trial passed PostgreSQL 18 encrypted archive, deliberately rejected full raw schema replay, selective eight-object table data restore, row hashes and two-owner claim RLS checks. Real local GoTrue is tested in separate signed Core App Lab, not in the synthetic restore.
- 2026-10-22 05:47 UTC read-only hosted mosaic-dev audit: ACTIVE_HEALTHY, 81 Auth users (78 marked test accounts with frozen authority/banned, three not marked), 58 tasks (nine non-deleted), 53 categories (one non-deleted), 81 core authority rows (78 frozen). No hosted Diary or retired_on column, RLS present, anon task/category read and RPC execution denied. Three privileged signed RPC lint WARNs and disabled leaked-password-protection WARN persist.
- The Fedora-only age-encrypted snapshot and private key are inaccessible remotely; its restore and real Auth identity recovery remain unverified. DO NOT erase hosted records, upload backup/key, run wholesale pg_restore or assert recovery.

## Task scope
- Extend offline read-only TOC check to fail closed if Auth identity links, core authority ledger or monotonic owner revisions are missing; preserve minimal privacy-safe output.
- Update generated-credential synthetic CI fixture to include Auth identity rows and nine-table selective restore; add parser regressions and docs. No hosted schema/config writes, app version change, dev/main promotion or Production deployment.

## Next action
- Verify focused branch checks and new synthetic lab, squash to isolated Supabase branch, then require exact-SHA canonical Quality Gate, real GoTrue Core App Lab and Synthetic Restore Lab.
- When the owner can access the Fedora machine: privately execute the single read-only inspection command in supabase-poc/RESTORE_TOC.md, supply only sanitized JSON output. Then plan an exact allowlisted recovery of the real archive into disposable initialized Supabase with signed Auth and data-revision comparisons. The backup content and key must remain private.
- Do not apply hosted Diary/category migrations, change public signup or release until independent source backup recovery plus applicable device/compatibility/security gates and separate explicit approvals. Keep #1027/#1029/#857 open.
