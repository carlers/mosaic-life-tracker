# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1026 / #1027 core-only staging; fail-closed shared-task cache and command suppression, symmetric Appwrite return readiness.

## Verified predecessor
- PR #1028, refactor/1027-core-capability-reversible-20261019@858584989c33bec630562246def0ce79f4559441; task focused #39238072521 SUCCESS (6 capability tests); stable full #39238288636 attempt 1 failed pre-existing Chat scroll FAB visibility timing, re-run failed jobs attempt 2 returned full Quality Gate SUCCESS (browser shard 33/33).
- The trusted prebuilt receiver #39238781234 then REJECTED the accepted artifact due to cross-attempt mismatch: artifact tied to build attempt 1, canonical acceptance to attempt 2. Preserve receiver's CI-first provenance gate; do not weaken it or report trusted READY.
- Appwrite shipped full mode remains default; protected dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1 and main@b952f71ecd2add3172f90104bc0e856a2648ccc9 unchanged.

## This follow-up source scope
- src/hooks/useSharedTasks.ts rejects actions, suppresses cached shared-task items and peer data, and does not subscribe to queue, settlement events or network reload when the core-only profile lacks sharedTasks. Preserves owner-scoped cache/drafts without deleting anything. Full Appwrite behavior remains unchanged.
- tests/react/useSharedTasksCoreOnly.test.tsx has synthetic cached friend data plus denied action regressions; docs/CORE_MVP_PROVIDER_RETURN.md documents this data-protection boundary.
- No Supabase Auth, provider settings, cloud writes or appwrite changes. No CI receiver/security/release gate changes.
- Diary first feature immediately after working core-only MVP; issue #1029. Source-only symmetric Appwrite return invariants already in #1028 do not yet implement a live reverse importer.

## Verification
- This follow-up task focused/full canonical/trusted Preview not yet run at checkpoint authoring. No user-facing core-only mode has been activated, no approved Production migration or dev/main promotion.

## Next action
- Commit coherent follow-up on chatgpt/1027-shared-task-core-guard-20261019 [verify:focused], run focused checks and repair. Squash after focused SUCCESS via PR into isolated stable refactor/1027-core-capability-reversible-20261019; require fresh full canonical attempt-1 build plus matching trusted Preview prebuilt READY. Do not loosen artifact provenance.
- Then complete auth and single-writer runtime provider selection, suppress all other social writes and gated hidden side effects, signed hosted Supabase task/category integration, real bidirectional Appwrite return and disaster recovery; mobile verification before release. Issue #1029 Diary is next after core shipping.
