# Session checkpoint
Updated: 2026-10-26 Asia/Manila
Current task: #1027 diagnose local exact R2 isolated restore stage 04 on chatgpt/1027-r2-safe-stage-diagnostics-20261026.

## Accepted baseline
- Isolated recovery feature/1027-supabase-recovery-20261020@6ded0ea34438d64be98d6b939371b86d592e1cef. Stable full canonical, real GoTrue, 7/8/10 private table synthetic, age/Storage/ACL/Bucket restore labs PASS. Protected hosted Preview still reviewer gated; dev/main/Production unchanged.
- User authorized only mosaic-dev additive personal Settings/Bucket/link hosted SQL AFTER fresh private encrypted full source+media and independent real restore. Exact fresh R2 backup generation 20261026T121358327Z from protected main manual Actions #40320887302 SUCCESS and separately independent full ciphertext watch #40166002937 attempt2 SUCCESS.
- User Fedora one-command operator restore stage 01/02/03 PASS (private source SHA, complete encrypted ciphertext R2 download, both original PostgreSQL and Storage age authenticated, TOC inspected). Stage 04 local disposable PG17 restoration FAILED. Cleanup stage 07 PASS. No completed physical restore, no hosted DDL applied.
- Current restore-unified-r2.py hides stdout/stderr of the local subprocess intentionally, reporting only generic 'Guarded local recovery subprocess failed'; cannot know if Docker preflight, container initialization, PostgreSQL row restore/manifest or byte parity failed. Do not guess at real root cause.

## Current scoped source repair
- Emit allowlisted FIXED non-sensitive local substage tokens inside run-private-core-recovery.sh and restore_private_core_to_disposable.py; outer private R2 wrapper parses exact checkpoint tokens on failure, NEVER echoes raw stdout, stderr, secrets, source fields/SQL or private file paths. Preserve failure abort and cleanup. Test positive classification, unknown marker injection, generic error privacy and full old/new stage graph.
- Clean inherited MOSAIC_FRESH_SNAPSHOT_SHA256, MOSAIC_PERSONAL_SETTINGS_RESTORE, MOSAIC_BUCKET_LINKS_RESTORE, MOSAIC_SYNTHETIC_ARCHIVE_SHA256 from private child process env. Only reviewed restore profile sets new scoped grants internally. No source-table/owner-count acceptance or security waivers, no R2 or hosted changes.
- Source-only repair, synthetic focused Quality then stable full canonical/real recovery jobs. Distinguish diagnostic capability from verified root-cause repair. Operator repeats at most one concise exact-SHA private restore command only after accepted CI and when necessary.

## Next action
- Run focused CI, repair, squash isolated recovery, full exact-SHA canonical. Then one operator-safe invocation on already downloaded fresh immutable 20261026T121358327Z generation for actual substage evidence; do not proceed hosted migration until the entire original-password signed isolated restore and photo proof succeeds.
- After actual physical recovery PASS apply only already-approved additive mosaic-dev personal SQL, run live signed two-owner RLS/CAS/Storage negatives, capture fresh TEN-table R2 generation and independently verify new target. No Production cutover/dev/main/Preview approval implied.
