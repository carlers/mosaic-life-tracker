# Session checkpoint
Updated: 2026-10-28 Asia/Manila
Current task: #1027 complete independently verified fourteen-table AFTER-state R2 restore **without repeating the accepted snapshot**.

## Verified
- Recovery parent `feature/1027-supabase-recovery-20261020@243d958523877257ce8418e34f61c9e0ce9ff5d6`. Full Quality #40664282288 SUCCESS. Supabase Core App #40664282156 second attempt: core-app and signed artifact SUCCESS; protected Preview deployment is WAITING on reviewer and is not approved. No `dev`/`main`/Production actions.
- Owner source-pinned 14-table operator run: `MOSAIC_FOURTEEN_R2_EXACT_COMPLETED_SNAPSHOT: 20261028T100954899Z` plus Stage 03 encrypted Auth/PostgreSQL and full private media R2 commit PASS, Stage 04 independent distinct R2 reader ciphertext/profile PASS. The archive is immutable and **MUST NOT be recaptured, republished or pruned**.
- Stage 05 restoration: authenticated database and media age archives, exact TOC PASS; failed during Stage 04 of fresh loopback-only PG17 database restore. The nested parent hid the exact safe checkpoint behind `EXACT_FOURTEEN_LOCAL_RESTORE_NOT_VERIFIED`. Both detached worktrees/local stack were cleaned; full 14-table restore NOT VERIFIED. Keep previous independently restored ten-table BEFORE `20261028T053525682Z` immutable too.
- Read-only hosted catalog: Scratch `mosaic-dev` has `public.mosaic_candidate_categories.retired_on` and `mosaic_candidate_category_task_tombstone`; 21 installed migrations, 87 Auth/accounts/provider bindings, zero consent/release evidence. The previous 14-table disposable restore **omitted** the retired category column and atomic-delete migrations; mismatch can stop exact COPY into the fresh PG17 target. No hosted data changed.
- Independent specialist recovery runs for 10-table, Settings eight-table and real GoTrue succeeded on prior accepted source. These do NOT prove this new 14-table source has restored.

## Scoped repair / verification
- Isolated `chatgpt/1027-fourteen-restore-schema-20261028` source-only fix aligns **only fourteen-table disposable target** to installed category retirement/atomic-delete/Diary Realtime schema. Preserve historical 6/7/8/10 restore modes and hosted write/consent fences.
- Add pre-decrypt schema guard requiring the 14-table retirement column and atomic category guards. Extend real GitHub synthetic **fourteen-table** source/restore test to seed and read back nonempty retired_on metadata; no real user data in CI.
- Surface only an allowlisted nested local recovery checkpoint in operator failure; never raw provider logs, SQL, owner IDs or private values.
- Focused CI, merge only into isolated recovery then canonical and real synthetic 14-table specialist CI; do not claim a fix until verified.

## Next action
After accepted source + synthetic CI, run **restore-only** `restore-unified-r2.py --run --snapshot-id 20261028T100954899Z --recovery-profile fourteen-personal-identity --source-sha <new accepted SHA>` via exact fetched source on trusted Fedora using existing PG17 tools and read-only R2 key. **No write key, source PG password, backend Storage key or new backup is needed.** Output must reach `MOSAIC_R2_EXACT_SNAPSHOT_DISPOSABLE_RESTORE_PASS: 20261028T100954899Z` plus signed owner/private-media checks. If failure, report sanitized `MOSAIC_R2_RESTORE_SAFE_REASON`; fix source then restore-only again. No consent, release marker, writer-fence DDL, Preview reviewer or Production actions without separate gates.

Issue: https://github.com/carlers/mosaic-life-tracker/issues/1027
