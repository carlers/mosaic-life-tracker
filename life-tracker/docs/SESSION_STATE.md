# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 Supabase core MVP; scoped #1029 private-Diary bootstrap profile integration repair.

## Verified baseline
- Stable isolated recovery branch `feature/1027-supabase-recovery-20261020@35c74e0b45f2ed387ef8ebb6a985bb8e845ea76e`. PR #1239 merged into that branch; all four exact-SHA recovery workflows previously passed.
- Fedora operator-reported original archive recovery accepted: six Auth/core tables, 403 identical source/target restored rows; fresh original-password authentication, populated signed read (11 tasks, 2 categories), independent second-owner signed RLS denial and forged-write rejection passed. This is local disposable evidence only, not a hosted cutover or a shipped app release. The Fedora isolated stack and original encrypted backup remain preserved.
- On 2026-10-22, authorized read-only Supabase connector queries confirmed `mosaic-dev` healthy, hosted table counts 81 Auth users / 81 Auth identities / 81 core authorities / 49 owner revisions / 53 categories / 58 tasks. Authority distribution: 78 frozen and 3 Supabase-cloud. All six *counts* match the archived source; exact hosted row equality, mutations since the snapshot and readiness for existing-account cutover remain unverified.
- Hosted security advisors still report three intentionally exposed authenticated SECURITY DEFINER core RPC warnings needing signed authorization evidence and disabled leaked-password protection. No hosted Auth, schema or account rows were changed in this task.

## Working task
- App-owned `core-diary` selector reaches `src/lib/supabaseCoreBootstrap.ts` but was passed to the lower candidate runtime as `core-only`, despite supplying the Diary collection. The candidate runtime requires exact profile/collection parity and therefore rejects this path.
- Task-scoped repair forwards the selected `core-only` or `core-diary` profile unchanged and adds a regression to `tests/unit/supabaseCoreBootstrap.test.ts` proving the real Diary collection and guarded profile reach the runtime. This is source/test wiring only, not a hosted Diary migration or enabling a public feature.

## Next action
- Verify this coherent task commit with focused CI, review its exact-SHA checks, then merge only into the isolated recovery feature branch via reviewed task PR as permitted. Do not promote to dev/main/Production.
- Prioritize exact-content hosted delta reconciliation and verified existing-owner mapping/old-PWA Appwrite server writer cutoff before account migration. Complete hosted Diary migrations and signed owner/negative tests (#1029), category retirement/deletion (#857), offline/two-device/device/PWA/rollback, separate public-registration/SMTP/operational checks, and explicit release authorization.
- No further local private-archive restoration or password tests are required unless new evidence calls for them. Do not stop/reset/reimport the Fedora disposable stack.
