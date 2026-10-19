# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 privileged Supabase CAS security review and provider-neutral eight-domain synthetic acceptance fixtures.

## Baseline and boundary
- Branch chatgpt/967-cas-threat-fixture-20261019 from accepted isolated stable refactor/967-provider-parity-audit-20261019@da3999d74b339915e07d324b32bfb2a9efed85a3 (PR #1015); canonical #39221951438 and trusted Preview #39222183787 SUCCESS.
- Protected dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1 and main@b952f71ecd2add3172f90104bc0e856a2648ccc9 unchanged at task start. Do not promote either.
- OCI Appwrite #975 and Supabase Free #967 remain separate reversible candidate providers. No hosted DB/schema/Auth data changes, Appwrite/OCI/Production changes, runtime provider selection or version bump approved.

## Work
- docs/SUPABASE_PRIVILEGED_CAS_REVIEW.md independently inventories the two hosted authenticated-callable SECURITY DEFINER CAS functions and ACL/owner/revision/patch protections. Records remaining server-owned task reactions/created-at, privacy, revision contention, Auth, signed-hosted proof and formal signoff gaps; two advisor WARNs remain unresolved. No security bypass, warning suppression or hosted privilege change.
- tests/fixtures/backendProviderParity.ts defines synthetic deterministic two-owner normal/soft-tombstone records for all eight current RxDB domains; tests/unit/backendProviderParity.test.ts checks schema, Appwrite mapping, two-row message and owner references, and Supabase candidate owner fence. Unit checks cannot establish provider-specific backend parity.
- Link the audit from docs/README.md and docs/BACKEND_PROVIDER_PARITY.md; no shipped app import or remote test data.

## Verification
- Full focused task CI and stable Preview acceptance **pending at checkpoint authoring**. Commit coherent task with [verify:focused], repair failures without weakening privacy guards, squash only into a fresh isolated stable Preview, require canonical full Quality Gate and trusted Preview READY.
- Signed hosted users, 6 remaining Supabase domains, formal RPC security signoff, media/Functions, credentials, independent DR, quota/OCI benchmarks and reversible cutover remain unresolved.

## Next action
- After focused and stable acceptance, post exact SHA/CI/deployment evidence into #967 and keep #975 linked and open. Prioritize portable provider fixture runner and genuine independently approved hosted/OCI tests when access and infrastructure gates are satisfied. Never alter dev/main/Production or release 1.0 without separate explicit approval.
