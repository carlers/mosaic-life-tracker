# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #1029 private Diary signed transport, coordinated with public core+Diary #1027 and category retirement #857.

## Baseline and safety
- Isolated stable `feature/1027-supabase-recovery-20261020@4479983878e4129a46936683352270752c503603` has the SQL-only Diary table, owner SELECT/INSERT RLS, signed authority trigger, exact-revision CAS, validation and disposable lab acceptance. Same-SHA full Quality Gate #39650558703 and signed Core App Lab #39650558595 succeeded. **No hosted Diary SQL, Diary sync or public signup enabled**.
- Tasks/categories core v0.32.5 protected Preview is verified; owner reports realtime sync works. Two older orphaned beta tasks remain untouched.
- User explicitly wants owner-private Diary AND category retirement/destructive deletion as prerequisites to future PUBLIC signup launch; no social/image support; current dev/main are newer unrelated Appwrite release lines and must not be overwritten.

## Current task branch
- `chatgpt/1029-diary-signed-transports` starts at stable `44799838...`. No end-user version bump or UI activation.
- Extends isolated signed candidate mapping to Diary rows, preserving dates, text, emoji, legacy attachment references, timestamps, owner, tombstones; refuses non-private Diary and incorrect account. Adds owner-only change cursor query, allowlisted CAS RPC and authenticated create/master methods for Diary, alongside task/category behavior. Adds synthetic mapping and negative tests.
- **The RxDB pilot still refuses Diary domain** until the third owner-fenced collection is implemented and tested, and the core runtime currently starts only task/category writers. No false claim of working offline Diary yet. No hosted data migration or public Auth change.
- Next: focused CI, fix failures; if accepted, squash to isolated stable followed by same-SHA canonical checks. Then create Diary RxDB pilot with strict private fields and owner leases, connect app boot + realtime wake and signed 2-owner/offline conflict tests; finally enable Diary capability with appropriate Preview version.

## Next action
- Run focused Diary transport checks before connecting a third RxDB writer and enabling UI.

## Release blockers
- Category #857 versioned v0.33.0 task on separate `chatgpt/857-category-retirement-contract-current`; CI repairs in flight, not merged. Need server-side atomic cascade race guarantees and migration acceptance before sending to users.
- Missing independent DR restore, current dev/main reconciliation, old PWA update/return, public Auth abuse controls and anti-enumeration, hosted two-owner signed Diary test, and owner-approved release target. No changes to Production, dev/main or Appwrite authority.
