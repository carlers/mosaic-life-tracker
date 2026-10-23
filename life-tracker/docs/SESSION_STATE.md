# Session checkpoint

Updated: 2026-10-23 UTC
Current task: #1027 v0.47.0 owner-private task + Diary photo acceptance.

## Exact verified state
- Isolated stable `feature/1027-supabase-recovery-20261020@442046a27902811994da5bfd117566fa929cf6ed`; `dev@95ecd0b` and `main@319421a` stay Appwrite. No Production or hosted DB/Storage writes authorized by this task.
- Stable v0.47.0 Quality #39940031255 SUCCESS, Synthetic Restore #39940031148 SUCCESS, Real GoTrue Restore #39940031228 SUCCESS. Core App #39940031175 FAILED signed Diary UI: photos uploaded to disposable Storage but local Diary save rejected with obsolete `useDiary` core-diary "uploads not available" guard. Test reached signed browser phase; local Storage migration and policy validation passed. Artifact/protected Preview skipped.
- `mosaic-dev` `hcxtiifzxoaflhjgoglb` read-only inspection: 63 task rows, 54 category rows, 1 Diary row and **zero photo buckets/objects**. This is live Scratch; it has real personal data. Existing `hosted-encrypted-backup.sh` captures PG only; not independently restored and not Storage object bytes. Do **not** apply photo migration or deploy user-facing v0.47.0 without fresh, verifiable encrypted DB/media DR and signed hosted owner-isolation checks.
- New scoped repair branch `chatgpt/1027-supabase-photo-lab-filter-20261023` from 442046: permit private Diary photo saves/edits in local hook (preserve private visibility and bounded opaque ID verification), regression React tests, include `@photo-storage` in Core Diary CI grep (previous filter silently skipped it). Internal fix, version remains v0.47.0.

## Remaining product/release gates
- **Only social deferred** means private Bucket List/links and synced owner-private settings still need Supabase parity; v0.47.0 photos alone do not complete personal MVP.
- Pre-Oct-31 Appwrite Cloud quota blockage defers historical cross-provider backfill; an earlier public launch requires disclosed optional ZIP Merge / TodoMate reimport, device/offline safety and genuinely recoverable photo bytes. Preserve original archives and PWA local data.
- PR #1281 sync-audit snapshot fence still open; automatic drift repair, old-Appwrite writer fencing, provider-return/media disaster recovery, signed mobile and cross-tab checks remain separate blockers.

## Next action
- Commit focused repair, run targeted CI. If passing squash into isolated stable, then full canonical + disposable signed Storage and second-device Diary tests and protected immutable Preview artifact. Investigate real failures and repair without relaxing assertions. Only then consider separately gated fresh encrypted Scratch snapshot, hosted additive bucket/RLS/CAS migration, signed two-owner denial, independent blob restore and Vercel reviewer approval. No dev/main/Production promotion without owner authorization.
