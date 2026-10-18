# Session checkpoint

Updated: 2026-10-18 UTC
Current task: Isolated Supabase Free feasibility experiment; NO provider migration.

## Exact source and authorization

- Application source base: `dev@87b3a1d027b088e55d4b6dfccb6230b7df053f68`, version v0.29.12. Main/Production unchanged. #858 Calendar performance investigation remains a separate open workstream.
- Owner explicitly authorized an isolated Supabase development project and told the agent to continue the proof of concept. No authorization for real-data import, app backend switch, Appwrite or Production changes, or any dev/main promotion.
- Supabase Free organization `kkivkiwzraenrbuutrfc`; isolated `mosaic-dev` project `hcxtiifzxoaflhjgoglb` (Singapore), creation cost quoted $0/month, project ACTIVE_HEALTHY.
- Task branch `chatgpt/supabase-isolated-feasibility-20261018`; intended stable Preview `refactor/supabase-feasibility-20261018`. Source changes are SQL research files/docs only; version impact **NONE**.

## Work performed and actual live state

- Supabase isolated project holds three POC migrations: `create_isolated_mosaic_sync_probe`, `create_isolated_rls_sync_feasibility_probe`, `isolate_commit_ordered_poc_change_revisions`. SQL source and rollback-only test queries are recorded under `supabase-poc/`.
- Live SQL simulated two JWT subjects under `authenticated` role. PASS owner-only read/update, cross-owner insert/update denied, anonymous read denied, client-supplied timestamp and revision rejected/overridden, physical delete denied, tombstone update, independent per-owner counters. No real signed Auth/JWT, HTTP SDK, real concurrent connections or Realtime tests yet.
- Diagnostic `EXPLAIN ANALYZE` on rolled-back 6,000-row synthetic data used owner/sequence index: 100-row pull about 0.074 ms database execution only; not end-to-end or sustained service speed. Security Advisor zero lints; Performance Advisor had informational unused-index suggestions.
- Both public probe tables confirmed empty after rollback. Existing Supabase projects, Appwrite, live Mosaic clients and users remain untouched.

## Required verification and next action

- Review the new SQL/source/doc diff; task `[verify:focused]`, squash to new stable Preview for canonical CI and trusted delivery, with no app version bump. Do not run POC SQL from CI or deploy it against any other project.
- `docs/SUPABASE_EVALUATION.md` owns test outcomes, reproducibility, risks and next proof gates. Real signed-user SDK RLS checks, multi-connection conflict/commit order, RxDB adapter, social/chat/diary authorization and free-tier envelopes remain before any backend migration decision.
- Await explicit approval before any eventual main/dev/Production promotion or real account/data change.
