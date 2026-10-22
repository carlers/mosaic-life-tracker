# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 fresh encrypted Supabase recovery acceptance and canonical checkpoint repair.

## Verified milestones
- Isolated candidate `feature/1027-supabase-recovery-20261020@e515a0d2ccb041fc0da0068de0b4aa4557ce66ea`; PR #1243 added the guarded local recovered-owner sign-in verifier. Its focused Quality Gate #39767333393 was SUCCESS.
- **Operator-reported fresh recovery PASS**: independently age-encrypted hosted `mosaic-dev` full logical snapshot, a NEW separate loopback-only Fedora PG17 stack, **403 exact source/target rows** across six Auth/core tables (81 Auth users, 81 identities, 81 authorities, 49 owner revisions, 53 categories, 58 tasks); old Auth sessions/tokens and writer leases excluded. Preserve the new and original snapshots and both private disposable stacks.
- **Operator-reported signed private original-account PASS on that NEW recovery**: original-password sign-in, signed `mosaic_core_session(acquire)` writer lease, populated owner's task/category read matching independent local SQL, and cross-owner restored task read isolation. No account ID, password, JWT or private row content disclosed. The earlier original-snapshot local stack separately passed synthetic second-owner forged-write denial.
- Exact merged SHA `e515a0d2...`: Supabase Core App Lab #39767534610, Synthetic Restore #39767534542 and Real GoTrue Restore #39767534511 **SUCCESS**. **Quality Gate #39767534551 FAILED** because this checkpoint's `## Next` heading violates the executable documentation contract requiring `## Next action`. Its build, browser and DOM tests passed. Fix the checkpoint in this coherent commit, then require new exact-SHA canonical acceptance; do not claim the failed SHA green.
- Read-only hosted `mosaic-dev` inventory: 81 users/81 identities/81 authorities/49 revisions/53 categories/58 tasks; 184 Auth sessions, 228 refresh tokens, 150 old leases, zero Storage buckets/objects at inspection. Private Diary table, category `retired_on` and atomic category-delete trigger are NOT installed hosted. Read-only counts do not certify full hosted data/content parity or Auth settings recovery.

## Scope and boundaries
- The task fixes the current checkpoint's tested `## Next action` heading and updates true fresh-snapshot recovery/CI evidence. No code/runtime/schema changes.
- Six-table core recovery plus signed RLS checks are NOT complete managed Auth/SMTP/role/hook, full-storage, all-domain or Production recovery. Passwords/keys and both Fedora recovery instances stay private and preserved.
- Existing Appwrite shipped accounts and old PWAs remain a distinct authority. No unverified identity mapping, concurrent writers, production account import, rollback or cross-provider promotion.

## Next action
- Verify focused CI for this task, squash only into the isolated `feature/1027-supabase-recovery-20261020` branch, and require new exact-SHA canonical Quality Gate plus Core App, Synthetic Restore and Real GoTrue lab SUCCESS before any handoff.
- Prepare and validate complete managed Auth/SMTP/config rollback/independent recovery and an **Appwrite server-enforced old-PWA writer cutoff** with trusted original-owner mapping/reverse replay; do not remove provider protections or change live data.
- Only after those safeguards, review separately staged hosted private Diary, reversible category retirement and atomic all-task deletion migrations under issue #1029/#857, then signed hosted two-user denial and cross-device offline/PWA tests. Isolated core-diary Preview, public signup security, `dev`/`main`/Production deployment and 1.0 release remain separate approvals/gates.
