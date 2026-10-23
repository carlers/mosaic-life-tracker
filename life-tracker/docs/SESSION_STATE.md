# Session checkpoint

Updated: 2026-10-23 UTC
Current task: #1027 Supabase three-domain Sync Now integrity verification and backend/build target identity, plus #967 post-release reversible provider migration priority.

## Exact starting point / change scope
- Isolated feature `feature/1027-supabase-recovery-20261020@964f671a8d6445aaffd62ae4bc20230df010031d`: v0.45.0 protected immutable `core-diary` Preview READY at `https://mosaic-life-tracker-l1s5gaj6f-carls-projects-72516fde.vercel.app`. Hosted mosaic-dev private Diary RLS/CAS and Realtime installed after encrypted 403-row independent restore + original-owner signed recovery. Real-device owner user reports task/category/Diary create, edit, date move and deletion passed. Do not conflate manual CRUD with corruption recovery.
- `dev@95ecd0b1b8ba1e5ec2e1716ae41a63582093721e`, `main@319421a35a19ad43b2c3c253806c65b131c64722` unchanged. No Production promotion authorized.
- Task branch `chatgpt/1027-supabase-sync-verify-backend-label-20261023`, candidate **v0.46.0**.

## Changes under focused review
- Production/Appwrite Sync Now calls `refreshSync(...reconcile:true)`: 8 domains, first native freshness, full paginated owner-scope reconciliation with guarded local repairs, then final freshness. Existing Supabase Sync Now called nonawaited `reSync()`, with no local verification or progress; status was based on settling only.
- Candidate v0.46.0: signed, paginated (100/page, bounded) **read-only anti-entropy proof** for tasks/categories/Diary from revision 0 including soft tombstones; compare normalized local and cloud owner records, verify signed token/epoch during every page, retain local contents and checkpoints on any drift. Three phases: await native refresh, verify all 3 owned groups with counts, final fresh convergence; publish truthful progress in existing Sync Status UI; fail-closed on drift/conflicts/offline with no false 100% or silent overwrites. This is **detection/verification first, not Production's automatic drift repair**; separate conflict-safe proof is required before calling provider parity complete.
- Build Version details display `backend: appwrite-cloud/production|scratch`, `appwrite-oracle/production|scratch|unknown`, or `supabase/scratch|unknown` derived from effective backend/target, not a misleading hardcoded Appwrite label. Supabase current hosted `mosaic-dev` is scratch, not Production.
- Roadmap priority: after separately approved production release, **one-prompt reversible Appwrite Cloud/Oracle ↔ Supabase provider migration BEFORE social**, with encrypted backup/restore, auth/identity mapping, offline/old-PWA writer fencing, idempotent all-domain data+attachment copy, signed counts/hash/RLS/device acceptance and rollback; a few-minute goal, never bypass preflight or Production approvals. Track #967 and #1027.

## Final scoped hardening
- Fail-closed TodoMate Replace on an empty category/task snapshot, before any safety-backup or data write. Do not report unsupported Supabase photo bytes as copied or emit invalid 0/0 media progress. Narrow regression added; no provider/real-user write.

## Next action
- Canonical Quality #39924203163 build failed on generic RxDB MangoQuerySelector typing in the local owner scan (`candidateRxdbPilot.ts:533`); the task-focused 2,273-test suite passed. Scoped fix reads the shared local RxDB via typed `find().exec()` and **ignores foreign cached rows** before comparison, preserving cross-owner isolation. Add regression for both owners cached locally and no writes. No live data or Production changes.
- First focused CI #39923528993 ran 2,273 passing tests and found ONLY the mandatory checkpoint heading; repaired to 'Next action'. Rerun focused Quality, fix any substantive failures. Do not merge to isolated stable or stage new protected Vercel Preview without exact focused green and canonical acceptance.
- Need additional proven conflict-aware **automatic local repair** for true Production parity. Need hosted signed two-owner, offline drafts, stale checkpoint > retention, cross-tab and mobile/manual tests, complete managed Auth/SMTP DR + reversible provider cutover before Production.
