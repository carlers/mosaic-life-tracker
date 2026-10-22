# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1029 signed two-owner private Diary HTTP acceptance, coordinated with #857 category retirement and #1027 Supabase public release.

## Baseline verified
- Isolated source `feature/1027-supabase-recovery-20261020@113297aadba8c1e4d3355a83c54b218a05b9a259` contains source-only private Diary/RxDB Realtime plus v0.33.0 retirement/restore and atomic category-task deletion. The initial combined full Quality Gate #39705342859 passed, but the signed Core App Lab #39705342860 failed 4 browser cases due to absent vs empty `retiredOn` metadata; candidate canonical repair PR #1215 focused #39706180012 passed. Accepted source merged full Quality Gate #39706353699 passed, signed Core App Lab #39706354105 pending at current task start.
- The hosted Supabase project `mosaic-dev` still lacks Diary/retiredOn columns; data untouched, 2 historical active orphaned tasks remain. Invite gate still on; v0.32.5 core-only Preview stable. Newer Appwrite dev/main remain separate and must not be overwritten.
- Owner requested personal core+Diary public launch with reversible category retirement and explicit category+tasks deletion. Social/images deferred. Signed privacy, backups/restore, PWA upgrades, current dev integration, Free tier capacity, and Auth abuse guards remain prerequisites. Production/public signup not authorized before release gates.

## Current task branch
- `chatgpt/1029-signed-private-diary-http-e2e` begins at `113297aa...`, no hosted mutation or Preview version bump.
- Adds real signed disposable GoTrue two-account HTTP acceptance to the existing local Supabase Core App Lab: private Diary INSERT/read and exact revision CAS; prevents cross-account/anonymous read and foreign INSERT/CAS; rejects public visibility and direct privileged UPDATE; protects stale write and forbidden fields; retains owner tombstones/date.
- Must remain skipped on hosted until a reviewed hosted schema migration and disposable hosted fixtures are ready. No weakening of CAS, RLS, grants or session fences.

## Next action
- Run focused Gate on this test-only task branch; repair failures in batch, then squash to isolated stable with same-SHA full Quality Gate and signed Core App Lab.
- Only after signed/hosted owner-private Diary tests, independent backup/recovery and PWA/dev version reconciliation may the team stage protected v0.33.0 Preview. Public signup/Production remain closed until the owner approves exact release.
