# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 backend-agnostic three-installation writer and reversible cutover identity contract.

## Baseline and boundary
- Latest accepted isolated Preview: `refactor/1027-core-async-owner-fence-20261020@6b5fed28e64712807bdd47475e6dd3277fadd7ac` (PRs #1069/#1070, full #39391407192 SUCCESS, trusted #39391635945 READY).
- Current task branch: `chatgpt/1027-three-provider-identity-contract-20261020`; version impact NONE. No user-facing provider switch. `dev`, `main`, Appwrite Production, hosted Supabase, OCI and user data unchanged.
- Backend choices: Appwrite Cloud, Appwrite on Oracle, Supabase Cloud. All remain viable; provider reversibility and single writer are mandatory.

## Source changes
- `src/lib/backendCapabilities.ts`: distinguish three backend targets from their two shared SDK drivers, canonical stable Mosaic owner ID from backend-native identity, and installation fingerprint from provider kind; fail closed on duplicate same-account/domain writers, native-account alias collisions and missing identities.
- Replace two-option return gate with installation-aware source/destination, permitting Appwrite Cloud ↔ Oracle as a true migration and either Appwrite ↔ Supabase, but never bypassing snapshots, pending writes, old-client fences or DR checks.
- `supabase-poc/candidateCoreRuntime.ts`: pass verified mapped legacy owner and Supabase project origin into guarded candidate writer contract after existing mapping/old-writer/lease checks. No actual installed client provider routing.
- `tests/unit/backendCapabilities.test.ts`: verify all three backend options, same-driver cross-installation conflicts, different native IDs for same canonical owner, foreign owner alias, reverse migrations and denial gates.
- `docs/CORE_MVP_PROVIDER_RETURN.md`: distinguish source-only assertions from server-enforced real migration requirements.

## Verification
- Source-only changes, task SHA focused CI required; no CI, trusted deployment or hosted signed-user acceptance from this new task asserted yet.

## Next action
- Run focused gate on coherent task commit, repair if needed; squash to isolated stable Preview and require canonical full CI plus trusted prebuilt READY. Do not promote `dev` or `main` without explicit owner instruction.
- Then integrate real provider-aware Auth/bootstrap behind safe build selection, server-verified legacy↔Supabase owner registry, PWA/old Appwrite writer shutdown and cross-tab refresh fences, hosted signed ACL/security, reversible data movement, DR and multi-device acceptance. Diary #1029 is immediate after usable core release; OCI Appwrite #975 and Supabase #967 remain open.
