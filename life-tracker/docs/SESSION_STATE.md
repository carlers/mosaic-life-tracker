# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #857 Supabase category retirement/atomic deletion integration, #1029 private Diary, #1027 public core release.

## Verified baseline
- Isolated candidate `feature/1027-supabase-recovery-20261020@7a786ac99301da6275818e5401e0a1cced210e7d` includes v0.33.0 category retirement/restore, typed-confirm all-task deletion with server-owned atomic cascade, owner-private Diary signed RxDB app sync and guarded Realtime publication. Exact-SHA full Quality Gate #39705342859 **SUCCESS**. Signed disposable Core App Lab #39705342860 **FAILURE**: 4/8 browser cases failed with category creation/rename convergence and spurious conflict reviews; DB migration completed, tests included 2 passing and 2 skipped.
- Cause in new category metadata protocol: `retiredOn?: string` is omitted by existing local category inserts, but PostgreSQL `retired_on text not null default ''` appears in returned master. Exact canonical JSON comparison misclassifies omitted/empty as different, parking native RxDB push and blocking subsequent category rename/offline tests. Do not hide this by loosening CAS/owner rules.
- Hosted `mosaic-dev` still has no Diary table or retirement column; invite-only working v0.32.5 core Preview is unchanged. Newer Appwrite `dev` remains a different release/version and must not be overwritten. No Production, public signup or provider cutoff approval.

## Current task branch
- `chatgpt/857-category-default-conflict-repair` forked at accepted source `7a786ac...`. Normalize **only** the category canonical equality projection: undefined `retiredOn` and explicit empty field `''` are equivalent. Signed transport write mapping, return data, remote CAS, and genuine nonempty retirement dates remain unchanged.
- Add negative/positive signed native RxDB tests: first insert returns database default; subsequent CAS/remote read returns default; real nonempty retired date remains a conflict.
- All changes source/test/checkpoint only. No live Supabase DDL or Auth edits.

## Next action
- Focused Quality Gate and repair; if green, squash to isolated Supabase branch, rerun exact merged SHA full Quality Gate and signed Core App Lab. Investigate any remaining failed browser steps; do not claim signed acceptance without it.
- Review Appwrite retirement parity/return, trusted backup/restore of disposable hosted data, real two-owner hosted Diary/security, old PWA and Android/iOS acceptance, and public self-signup anti-abuse before any user release.
