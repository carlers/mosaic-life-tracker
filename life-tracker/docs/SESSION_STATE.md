# Session checkpoint

Updated: 2026-10-23 UTC
Current issues: #1027 isolated Supabase UI Preview; #1029 private Diary next.

## Exact live source and delivered gate
- Isolated `feature/1027-supabase-recovery-20261020@dcf685b91645efca2402295d3a20fbc319929e2d`, v0.44.1; UI reconciled from pinned `dev@ebc8614f379dcd7934316cd5c299d40ceae75e16`. PRs #1269–#1273 integrated new Calendar/Day View layout, timeline, keyboard, dropdown, colors, uncompleted tasks and compatibility fixes. No `dev`, `main` or Production promotions.
- Four canonical exact-SHA runs PASS: Quality #39898662992, Core App #39898662897, Real GoTrue Restore #39898663111 and Synthetic Restore #39898662931. Home static gzip 372558 B / 381000 B blocking. Verified artifact `12478177186` digest `sha256:e6c7f6f11803d76d42195bf3ea4fd215e78da6976f6fa96970c9ce2d998bc200`.
- Protected job `120237205640` in run #39898662897 was still WAITING on required reviewer approval for `mosaic-supabase-preview` at last check; Vercel had no deployment for exact SHA. Approve environment review, then verify exact immutable READY target before user-device testing. Do not bypass reviewer, alias, or change Production.

## Diary next; separate release gate
- `core-diary` owner-private source, RxDB pilot, SQL CAS + RLS and Realtime migration already exist; current hosted `mosaic-dev` lacks Diary table/migration, shipped Preview profile is `core-only`. Do NOT flip feature flag or apply hosted SQL without encrypted off-site snapshot, **independent restore** including Auth identities/roles, signed owner privacy/replication acceptance, and approval.
- Current isolated task `chatgpt/1029-signed-diary-acceptance-20261023` adds disposable signed Diary REST tests to `tests/e2e/supabase-core-app.spec.mjs`: pre-lease/anon denial, owner insert/read, foreign owner denial, immutable privacy/photos, exact CAS races/stale refusal, unique owner/date, tombstones and release denial. Hosted runs expressly skip this test. Version impact NONE, test-only.
- Do not squash the Diary test into isolated feature while the earlier v0.44.1 protected deployment job is pending: newer stable push cancels the outstanding reviewer run by Actions concurrency. Run task-focused verification; coordinate subsequent stable acceptance after reviewer approved v0.44.1.
- Open blockers: hosted Diary restore, migration/security certification, two-device Diary UI/Offline acceptance; signed existing-user Appwrite recovery delta and old-client server fence; task-photo storage and Bucket List backend parity; public release gates.

## Next action
- Task branch: focused CI for signed Diary test; inspect diff/results, repair if necessary; park ready PR until earlier deployment reviewer approval. Preview user should first test already accepted v0.44.1; do not claim Diary usable yet. After protected READY, merge/test accepted Diary guard changes in a subsequent isolated Preview candidate. No hosted backend writes.
