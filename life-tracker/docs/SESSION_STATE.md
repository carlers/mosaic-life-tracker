# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 coordinated local-only task CAS protection for original timestamp and reaction ownership.

## Baseline and guardrails
- Accepted predecessor refactor/967-cursor-security-contract-20261019@50347776966aa924d53646f9c04a7dfbabeed9ec, PR #1023, canonical #39230129094 SUCCESS and trusted Preview #39230420159 SUCCESS (prebuilt READY).
- Protected dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1 and main@b952f71ecd2add3172f90104bc0e856a2648ccc9 unchanged at task start. Existing hosted mosaic-dev SECURITY DEFINER task/category advisor WARNs remain unresolved. Keep OCI Appwrite #975 viable with Supabase Free #967.
- NO hosted database migration, Supabase Auth signup, Appwrite/OCI change, live configuration, Runtime provider import, dual-write, Production operation, protected branch promotion, paid VM claim or release approval.

## Scoped implementation
- New source-only supabase-poc/migrations/20261020_candidate_task_protected_fields.sql follows the initial candidate CAS migration ONLY inside the disposable Supabase CLI signed-browser workflow. It restricts task CAS updated field allowlist, tightens owner INSERT to blank reactions, and makes created_at immutable on UPDATE in row trigger. Initial created_at is still client-provided for backward-compatible historical data and is not yet a trusted origin.
- candidateCasTransport.ts rejects owner CAS patched created_at/reactions before network. candidateRxdbPilot.ts keeps ordinary task edits working by comparing protected field values against the verified signed master and omitting unchanged protected metadata from submitted CAS. Attempts to change them remain owner-scoped pending conflicts (including keep-local), while new task inserts with reactions are blocked pending trusted import/review.
- Signed local Supabase/Chromium JWT test adds forged task CAS and forged initial reaction denial, unchanged revision checks and positive owner CAS; preserve existing category RxDB offline/restart/same-owner race tests. New pure pilot tests cover preservation and explicit review behavior; existing candidate transport unit checks reject both protected fields.
- Only local candidate SQL/source-only pilot/tests/docs. Normal shipped Mosaic remains Appwrite.

## Verification
- At checkpoint creation, task-focused CI, dedicated disposable genuine-JWT signed browser integration, stable canonical full Quality Gate and CI-first trusted Preview are NOT YET VERIFIED. Treat GitHub Actions results and exact-SHA logs as truth. No hosted signoff or security warning suppression.

## Remaining gates and next action
- Create coherent task branch chatgpt/967-protected-fields-20261019 with [verify:focused], run genuine local signed lab, fix failures without weakening protections, squash only to isolated refactor/967-protected-fields-20261019 after both pass. Require full canonical stable gate and trusted prebuilt READY; post exact evidence to #967 and keep #975 open.
- Production-worthy design still needs original timestamp trust/legacy migration, actor-authorized friend reactions and blocking, independent RPC/RLS security audit, hosted JWT test with approved disposable-user lifecycle, six unported domains, Auth/session continuity, media/Functions, restore proof, Free budgets and old-client-safe cutover. Do not promote dev/main or Mosaic 1.0 without separate approval.
