# Session checkpoint

Updated: 2026-10-23 UTC
Current task: #1027 private task/Diary photos; isolated v0.47.0 full signed Storage acceptance.

## Live exact source
- `feature/1027-supabase-recovery-20261020@60520d1a0d7c7141daa29c0f300f4bdf37ee3bbb`, squash PR #1282. v0.47.0. `dev@95ecd0b`, `main@319421a` remain Appwrite; no production cutover.
- CI on 60520d1a: Quality #39937271778 SUCCESS, Synthetic Restore #39937271771 SUCCESS, Real GoTrue Restore #39937271765 SUCCESS. Core App #39937271935 FAILED solely at the signed Diary UI's legacy `Add photos` absent assertion; protected Preview/artifact jobs skipped. No photo backend rollout.
- Source contains private owner-UUID Storage WebP REST, Diary photo CAS, photo-aware ZIP read/import, strict owner cache partition. Hosted `mosaic-dev` has zero Storage buckets and no photo RLS; therefore source-only feature is NOT usable on existing Preview. Original working v0.46.0 Preview preserved.

## Scope and gates
- Owner requires all personal domains in MVP: tasks/categories/Diary/photos, Bucket List/task links and synced private settings. Only social may be deferred. Pre-Oct-31 Appwrite quota block means earlier public release is **fresh-start/self-service ZIP/TodoMate** only, not complete historical owner data migration. Preserve original archives/local PWA.
- Task `chatgpt/1027-supabase-storage-signed-lab-20261023` repairs invalid E2E assumptions, adds **disposable local Supabase Storage** migration/test service and genuinely signed two-owner file API/Diary UI photo tests, plus source-only metadata policy validation. No hosted schema/object writes, main/dev/Production changes. Internal test repair means **no new version**.
- Hosted Scratch rollout requires current recoverable encrypted DB **and Storage-object byte backup**, additive migration preflight, anonymous/foreign JWT denials on real hosted Storage and independent media restore, then exact canonical+protected Preview READY and device/offline/ZIP acceptance. PR #1281 owner-audit fence remains open; conflict-safe auto repair/old PWA writer fencing also outstanding.

## Next action
- Commit coherent task with `[verify:focused]`, repair focused results, then squash into isolated stable. Verify exact-head full Quality, synthetic and GoTrue restores, Core App signed Storage lab and protected artifact. Do not promote to dev/main/Production, or apply shared hosted Scratch SQL without reversible DR/approval evidence.
