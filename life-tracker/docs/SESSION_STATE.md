# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 one-command historical Appwrite R2 readiness audit and privacy review.

## Verified evidence
- Isolated Supabase recovery feature at `4ebcbce7780433755d3368905b18bd679cb3cbe4`. Prior canonical gate, Synthetic Restore, Real GoTrue PASS; Core App Lab was still in progress at task start. No dev/main or Production change.
- Fresh independently encrypted Supabase hosted-dev source restored to separate private PG17 Fedora instance: exact 403 six-table rows and operator-reported original-password sign-in, fresh authority, populated owner matching SQL and foreign-owner read isolation PASS. Not complete Auth/service rollback.
- Original Appwrite Cloud Mosaic DB quota suspended (HTTP 402). Existing independent DR Drill has 17 tables, 2,952 total rows, 6 Auth users, 137 files. Its data differ from the authenticated historical Oct 18 snapshot by net 35 records; not a proven production-current source.
- Operator-reported R2 `20261018T110129330Z` snapshot authenticity: 6 accounts, 2,987 rows across 17 tables, 137 files. Existing private `preflightSnapshot` succeeded for all 37 encrypted R2 resource objects / all 137 blob contents; 11 global encrypted account-deletion markers authentic. Backup completed 2026-10-18 11:02:24Z, now stale under mandatory 36-hour maximum. Global marker intersection and privacy-filtered counts not yet collected.
- Prior #1247 repaired `scrubDeletedUserRow` to reject erased `owner_id` and `invitee_id` in historical restored rows, with focused tests passing. No backend data mutation.

## Task change
- Build reusable `npm run dr:readiness -- --snapshot ... --expected-source ...` operator command consolidating R2 source-identity verification, authenticating all historical data objects/blobs/erasure markers, computing actual excluded archive users/rows/files and sanitizations with only aggregate output. Load existing secure env file automatically if required. No app version change and no provider/R2 writes.
- Regression tests for explicit source, row count, privacy filtering and non-disclosure. Document historical-only gate.

## Next action
- Verify exact task branch focused CI, squash to isolated `feature/1027-supabase-recovery-20261020`, and require four exact merged-SHA canonical checks. Operator runs **one** local command and shares aggregate results only; stop serial manual shell probes. Then independently reconcile 2026-10-18 archive with current suspended Appwrite source, 2026-10-15 DR project, erased owners and any offline unflushed drafts before any transfer.
- Trusted Appwrite account mapping/server-enforced old-PWA writer fencing, reverse backup, full hosted Auth/Diary/category migrations, signed multi-device acceptance, public registration review, dev/main/Production release approvals remain separate gates. Keep #1027/#1029/#857 open.
