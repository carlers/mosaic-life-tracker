# Session checkpoint

Updated: 2026-10-16 UTC
Current task: #889 pre-1.0 release rollout; approved #921 dev promotion completed, main security ancestry reconciliation underway.

## Current verified state
- Owner authorized stable→dev #921, Production Appwrite migration 010–015 and Function upgrade on 2026-10-16, subject to safe rollout. These approvals do **not** establish installed-v0.17.4-PWA retirement, authenticated current backup recoverability, real Production two-account/mobile acceptance or a 1.0.0 milestone decision. Protect those factual release gates.
- Protected `dev@99cd4729ed88c594abfd825ec65f3c60a0db0df5` v0.29.1 merged approved stable #921 normally; postmerge Quality Gate #38876370920 SUCCESS and exact Vercel Git dev `dpl_7pbJsNmBwraxjXPQQQi6Dq1gUh6S` READY. DR nullable-integer-default restore fidelity, tests/docs and #919 main-reviewed trust-pin sources are now on dev.
- Protected `main@1f146ba7e935a1f2595c176ca21f41413698d2c0` is **still v0.17.4** (main-only #919 security infrastructure merge); Production web release has not occurred. Main's three #919 code/test/runbook blobs are byte-identical to dev. Only historical `SESSION_STATE.md` content differs. Main and dev still diverge in Git ancestry until reconciled; #909 cannot merge yet.
- #914 generic source-only old-client compatibility gate is in dev. Old v0.17.4 strict Diary/message reader is **not compatible** with the new optional remote fields and cannot be upgraded retroactively by new checks. The owner controls the only *known* Production PWA; **no affirmative confirmation** yet that every old tab/PWA/account has synced all offline changes and been retired. This gate blocks schema changes that would break it.
- Production Appwrite `6a9703c50016b37110ff` still has 14 tables; 010/011/014 tables and 012/013 Diary and 015 Messages columns are absent. Production Functions retain hourly/daily schedules. Earlier R2 backup `20261015T110126518Z` passed strict isolated DR restore (6 users, 2,924 rows, 137 files), not a fresh Production backup check.

## Current task: non-destructive ancestry reconciliation
- Source-only Git-history integration modeled after #906, keeping dev tree `af312e91d6904e4d0b52e292096efcc4c72e13b0` unchanged; main is a second parent of task commit `f2df426438c9833932adba12ce333fa9da82897c` on `chatgpt/889-main-trust-ancestry-20261016`, targeting isolated stable `refactor/889-main-trust-ancestry-20261016` through PR #922.
- Protected stable forbade direct ref update and GitHub rejected a zero-diff PR merge; use the reviewed checkpoint diff and normal PR merge, **not squash/rebase**, to preserve ancestry.

## Production release safety gates
- Owner must positively verify every old Production v0.17.4 tab/PWA/account has synced any local queued writes and is closed/reinstalled/retired before 012/013/015. If not, use a proved compatibility alternative, not an incompatible rollout.
- Before a Production migration, authenticate a current R2 `COMPLETED` marker/decryption/key escrow/recoverability; use only exact project-pinned ordered `--only` migration 010, 011, 012, 013, 014, 015, never default unscoped runner or migration 008. Confirm each created schema resource READY, ownership and permissions.

## Next action
- Finish #922 through protected PR, preserving the ancestry merge commit and running full stable canonical/Preview checks. If GitHub merge restrictions persist, report a concrete protection/tool blocker rather than squash away history.
- Production write authorization exists but safe execution requires affirmative installed-PWA retirement and current backup authentication, plus repo-owned exact target migration/function deployment mechanism; do not substitute undocumented ad-hoc Console mutations.
