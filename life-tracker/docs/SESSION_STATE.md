# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 release prerequisite — operator-verified fresh encrypted backup and repeatable safe restore (source-only preparation).

## Verified state
- Isolated `feature/1027-supabase-recovery-20261020@6cfe65ff037df4f364d854636835905f588d8547` has four exact-SHA workflows SUCCESS (Quality Gate #39760723944, Core App #39760723026, Synthetic Restore #39760723021, Real GoTrue #39760723127). No dev/main/Production promotion.
- Private Fedora operator reported an exact original six-table 403-row local restoration, original-password login, signed positive populated-owner read, signed independent second-owner cross-owner denial and forged-write rejection. Preserve the original archive and the running loopback-only Fedora stack.
- Connected hosted `mosaic-dev` remains the same 403 six-table rows by count (81/81/81/49/53/58), 78 frozen/3 Supabase authorities. A read-only `updated_at/server_updated_at` check against the 2026-10-22T03:16:28Z source timestamp found one Auth user changed, zero task/category server-row timestamps after the snapshot. This is NOT byte/content reconciliation or a fresh rollback snapshot.
- Hosted development retains 11 migrations; private Diary, category retirement and atomic category-task delete are staged only, not installed hosted. Provider/readiness, public signup, old Appwrite/PWA server writer cutoff, reverse transfer and mobile acceptance remain open.

## Scoped implementation
- Original private recovery helper remains permanently pinned to its previously reviewed age archive by default.
- An explicit `--fresh-snapshot-sha256` operator-only mode enables the SAME strictly guarded, separate loopback PG17 six-core-data exact-content rehearsal for a newly encrypted hosted backup; rejects ambient overrides and invalid SHA syntax, preserves expected core table counts and excludes archived sessions/tokens/leases. A new pinned snapshot may not silently replace the original fixture.
- Adds a command-level source-pin regression test and documents the distinct new-snapshot procedure. No backend/data/config mutations.

## Next action
- Run focused verification, review branch and merge only into isolated feature if green. Recheck all four exact-SHA gates. No status-only follow-up commit.
- Before **any** hosted Diary/category migration, operator takes a new encrypted complete hosted logical backup and proves independent disposable restore, then documents reconciled full Auth/config/Storage rollback; never use the existing Fedora recovered target. Current source permits an independently pinned new six-table rehearsal, NOT a full-service restore proof.
- After safe backup gate, stage reviewed Diary/retirement/atomic deletion SQL against mosaic-dev, rerun hosted signed owner privacy and UI/offline/replay/rollback tests; then isolated versioned core-diary Preview, physical devices and explicit release gates. No public registration or Production changes until those checks pass.
