# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 read-only privileged CAS field-ownership design and provider acceptance bigint/cursor hardening.

## Verified baseline
- Accepted isolated refactor/967-provider-contract-signed-local-20261019@ad6de18fca1b55dc94c6256a3a11fce2ac7f7d9c, PR #1019, canonical #39227581978 SUCCESS, signed local Auth/Chromium #39227582313 SUCCESS (3 tests), trusted Preview #39227825503 SUCCESS (CI-first READY).
- At task start dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1, main@b952f71ecd2add3172f90104bc0e856a2648ccc9. No dev/main/Production/hosted Auth/Appwrite/OCI changes authorized. Supabase #967 and OCI Appwrite #975 remain parallel, reversible options.
- Hosted Supabase owner-private prototype still has two security advisor WARNs; task RPC currently allows created_at/reactions client modifications. No formal security signoff and no deployed schema changes this task.

## This scope
- tests/provider/ownerPrivateAcceptance.mjs rejects unsafe JS numeric PostgreSQL bigint revision in portable signed-provider adapter acceptance, rather than silently rounding string checkpoint precision.
- tests/unit/backendOwnerPrivateAcceptance.test.ts fixes revision-number mock behavior and adds adversarial cases: unsafe numeric revision, reversed incremental cursor, missing soft tombstone; existing foreign-owner and stale-CAS negative cases unchanged.
- docs/SUPABASE_PRIVILEGED_CAS_REVIEW.md documents explicit coordinated database + pilot field-ownership hardening design, negative-JWT acceptance plan, future trusted reaction handler, and why unilateral SQL allowlist changes would break the existing whole-document pilot.
- Changes are confined to offline test tooling/docs. No SQL migration, CAS privilege/role, current Appwrite runtime, remote service or security warning modifications.

## Verification
- Focused CI, canonical stable Preview and trusted prebuilt Preview are pending at checkpoint creation; use exact remote Actions for final truth.
- The current candidate still permits owner-authored creation timestamps and reactions fields. Do not claim these gaps closed until a matching versioned local candidate schema, non-destructive pilot behavior, genuine JWT negative tests and formal signoff pass.

## Next action
- Commit task branch with [verify:focused]. After focused success squash to new isolated stable Preview and require full canonical Quality Gate and trusted prebuilt READY. Save exact evidence in #967 issue.
- Separately implement and evaluate protected task-field semantics atomically on disposable local candidate and pilot, with authorized hosted changes only after independent review. Keep OCI #975, six unported Supabase domains, Auth continuity, media, DR and old-client-safe cutover open. No dev/main promotion or 1.0 without owner approval.
