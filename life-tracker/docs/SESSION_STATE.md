# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1250 emergency ZIP + TodoMate Replace migration rehearsal against isolated Supabase.

## Verified historical boundaries
- Isolated Supabase feature baseline `3928d5a533e1a724cfb532e55f52a94ef72b8737` passed all four exact-SHA Quality/Core App/Synthetic/GoTrue CI gates; `dev` is a separate later frontend version. Original Appwrite Cloud is still quota-suspended. No hosted real user writes or branch promotions authorized.
- Historical R2 archive after deletion markers: five eligible original owners, 2,361 retained rows/121 retained files. Stale after Oct 18; post-snapshot source changes, offline PWA outbox and writer fencing unverified.
- Existing Mosaic backup ZIP/JSON v1–v4 and authenticated TodoMate Firebase importer are reusable. Legacy ZIP exports omit tombstones and may lack uncached photos. Preserve the original ZIP.

## Current task scope
- User approved TodoMate Replace with destructive confirmation: tasks/categories authoritative, Diary merge, all settings/Bucket List/social/auth data preserved. Safety backup downloaded before writes; after rows successfully apply, current-only tasks/categories tombstoned. Only trusted in-memory TodoMate transfer can use the mode.
- Port personal ZIP/TodoMate Merge to Supabase: signed live owner verification and RxDB awaitInitialReplication/awaitInSync before and after apply, no Appwrite account/storage request, tasks/categories plus optional supported Diary. No Supabase media storage yet; keep original ZIP and download TodoMate transfer ZIP if photos prepared, warn about unavailable files.
- React/UI and unit tests; candidate Preview MINOR version **0.44.0**, compared with current `dev` version `0.43.2`. This branch differs from active `dev` source, so no dev/main promotion without an explicit reconciliation and fresh full acceptance. Code changes remain isolated from hosted data and old Appwrite Cloud.

## Final scoped hardening
- Fail-closed TodoMate Replace on an empty category/task snapshot, before any safety-backup or data write. Do not report unsupported Supabase photo bytes as copied or emit invalid 0/0 media progress. Narrow regression added; no provider/real-user write.

## Next action
- Focused CI for import code and version, repair regressions, squash into isolated Supabase Preview after acceptance; test exact Preview and signed disposable/hosted import with **synthetic accounts first**.
- Real signed two-device restore from user-owned ZIP and TodoMate preview, absent media/unsupported-domain handling and privacy proof before any **explicitly approved** real-user Production cutover. Returning to Appwrite requires a fresh authoritative export and server-enforced old-PWA writer cutoff (#914); never active-active writers. Keep #1027/#1250/#1029 open.
