# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #967 — candidate Supabase task/category pure mapping and unit proof.

## Boundary and source

- Base accepted Preview `refactor/supabase-candidate-task-category-20261018@01206108a014423b6da885c3fc271a8e71d61ba0`, inherited from `dev@87b3a1d027b088e55d4b6dfccb6230b7df053f68`. No version bump; still v0.29.12. No dev/main/Production promotion.
- Work is a pure source-only Supabase mapping candidate, **not** live SDK/RxDB usage. Task branch `chatgpt/supabase-candidate-mapping-20261018`; intended stable Preview `refactor/supabase-candidate-mapping-20261018`.
- Actual Supabase project `mosaic-dev` remains isolated and synthetic (Free plan, Singapore). No new cloud writes or Auth accounts needed for this step. Appwrite Scratch/Production, user data, Vercel runtime configuration, auth provider and real services untouched.
- Active migration and future dual-server planning issues: #967 and #968. Keep both open.

## Scoped implementation

- `supabase-poc/candidateMapping.ts`: typed pure task/category mapping between legacy RxDB documents and the isolated Supabase SQL row shape; explicit legacy ID to Supabase UUID mapping required; wrong-account fail-closed; preserve empty string, string row IDs, dates, tombstone fields, optional data and visibility metadata. Never send server-controlled revision/timestamp fields. PostgreSQL BIGINT cursor parsing is exact, rejects unsafe JS numbers.
- `tests/unit/supabaseCandidateMapping.test.ts`: task/category round trips, foreign-user rejection, identity-map validation, original IDs, no cursor spoofing and bigint precision.
- `docs/SUPABASE_EVALUATION.md`: distinguish this mapping proof from real signed session, adapter, Realtime and data migration. Version impact NONE.

## Next action

- Run task focused CI for this exact change; repair any failures; squash to separate stable Preview; verify canonical CI and trusted delivery. No automatic database migration or changed Production service.
- Then continue isolated #967: signed two-user Auth/HTTP tests, CAS racing transactions, real RxDB adapter with replay/reconnect proof, all eight domain ACLs, user identity/password migration, storage, functions and secure DR/cutover. No live user data or production writes without explicit separately reviewed authorization.
