# Session checkpoint

Updated: 2026-10-23 UTC
Current task: #1027 owner-private Supabase task + Diary photos (and #1250 personal ZIP/TodoMate recovery).

## Verified source and objective
- Isolated stable `feature/1027-supabase-recovery-20261020@701a65ea660e2ee3aaf5ef2f6e07d29d65df06ae` v0.46.0; exact canonical PASS and protected immutable Preview READY `https://mosaic-life-tracker-etpx9rsml-carls-projects-72516fde.vercel.app`. Owner manually accepted task/category/Diary CRUD and three-domain Sync Now.
- Dev `95ecd0b`, main `319421a` unchanged; public Production still Appwrite Cloud. Existing Appwrite Cloud data is quota-blocked until expected Oct 31. Early release may rely only on explicitly incomplete ZIP Merge / TodoMate re-import and fresh accounts; do not call legacy data migrated or trust missing ZIP rows as deletions.
- User expanded personal MVP: task/Diary photos, synced private settings and owner-private Bucket List/links all belong before release. **Only social** is deferred. Supabase currently has no settings/Bucket List backend parity; these remain outstanding.
- New v0.47.0 task branch `chatgpt/1027-supabase-private-photos-20261023` at initial `5c15fe12`; adds owner-bound Supabase Storage WebP REST, private authenticated RLS bucket source migration, Diary photos CAS, task + Diary UI upload/download, per-owner caches and ZIP image Merge/export. Existing hosted mosaic-dev has zero buckets/policies; **new source is not deployed** and no hosted schema/data/Auth writes have occurred.
- Offline new photo upload fails visibly rather than creating a dangling local reference. Owner-scoped cached photos may be available offline only while the signed local media binding stays valid. Real signed cross-owner RLS tests, media backup/restore including object bytes, offline/device/PWA/manual acceptance remain necessary. PR #1281 sync audit race hardening still open; automatic repair and Appwrite legacy-writer fencing remain release blockers.

## Next action
- First focused v0.47.0 CI `#39935970789` found four stale contract expectations (Diary CAS photos and taskImages enabled, handoff too long), while all nine new Supabase media unit tests passed. Update tests to prove safe private image edits and retain date/owner/visibility/creation rejection; shorten checkpoint and rerun focused gate on repaired task SHA.
- After focused green, reviewed task PR squash to isolated stable, new exact canonical+Supabase Labs and protected Preview. A separate gated hosted scratch Storage migration needs fresh encrypted backup, reviewed permission/catalog checks, true signed two-owner photo read/write/denial proof and independent media restore before any user photos. No dev/main/Production promotion or live data migration implied.
