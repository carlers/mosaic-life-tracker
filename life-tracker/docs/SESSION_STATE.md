# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #967 isolated Supabase migration candidate (tasks/categories) after accepted feasibility Preview #966.

## Source and authorization

- Base: stable feasibility Preview `refactor/supabase-feasibility-20261018@8d245cbcb4fb4f9a071e3f8f9a1eda1064cebfcf`, itself based on `dev@87b3a1d027b088e55d4b6dfccb6230b7df053f68`. App version unchanged: v0.29.12.
- User authorized continued Appwrite→Supabase migration development but **not** real account/data migration, changed live client/backend defaults, Preview→dev/main/Production promotion or public 1.0 release. Keep the active migration issue #967 open; #968 is post-1.0 optional dual cloud/home server concept.
- Source task branch: `chatgpt/supabase-migration-task-category-20261018`; isolated next stable Preview candidate: `refactor/supabase-candidate-task-category-20261018`.
- Isolated hosted experiment only: Supabase `mosaic-dev`, Free, Singapore, project `hcxtiifzxoaflhjgoglb`; Appwrite Scratch, Appwrite Production, user accounts and shipped Mosaic app untouched.

## Changes and evidence

- Live Supabase experiment added `public.mosaic_candidate_tasks` and `public.mosaic_candidate_categories`, private monotonic per-user revisions, owner-only RLS and indexed cursors; owner IDs must map from Appwrite strings to Supabase Auth UUIDs in a future approved migration.
- **Security regression found and fixed:** a default Supabase authenticated DELETE grant allowed hard-delete in the initial candidate. Applied an isolated hardening migration that explicitly revoked all authenticated table privileges before granting SELECT/INSERT/UPDATE. No Production changes.
- Synthetic SQL role/claim tests: cross-user SELECT/UPDATE/INSERT denied; no deletion; immutable owner, stale CAS 0 writes, owner revision monotonic across both collections, tombstone revision advances, anon SELECT denied. Re-ran both stored rollback-only SQL tests: PASS. Readback: 0 candidate task/category/revision rows. Security Advisor: 0 findings.
- Checked in SQL sources under `supabase-poc/migrations/`, rollback-only tests under `supabase-poc/tests/`, and scope/results in `docs/SUPABASE_EVALUATION.md`. Version impact NONE, no real Auth/JWT/Realtime/RxDB client validation claimed.

## Next action

- Inspect exact branch diff and run `[verify:focused]` for task-branch docs/SQL source, then squash to new isolated stable Preview for canonical acceptance/trusted delivery. Do not auto-apply SQL migrations in CI or any other project.
- Continue #967 in separate bounded phases: signed Auth owner tests, faithful mapping of all eight RxDB domains and per-user IDs, cross-user chat/social security, real concurrent CAS, reconciliation/Realtime replay, encrypted backup/restore, cost measurement and explicit migration cutover gates.
- No dev/main promotion or real data cutover without explicit user review and approval. Calendar performance #858 remains separate/open.
