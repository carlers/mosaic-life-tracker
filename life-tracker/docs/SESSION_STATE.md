# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 prepare real disposable Supabase Auth signed-user permission testing, without a provider switch.

## Boundary
- Forked accepted isolated source refactor/967-cas-write-transport-20261019@9b8f91596c07dccc6f0281e8ef2aa66a792a1938 (canonical #39181028620 SUCCESS, trusted Preview #39181192332 SUCCESS and READY).
- Task chatgpt/967-signed-auth-denial-probe-20261019; source-only probe. Shipped Mosaic/Appwrite untouched. Isolated Supabase mosaic-dev healthy at last inspection, no schema, accounts, rows, Function, Storage, or remote provider writes this task.
- Protected dev/main release branches remain independent; no version bump, UI/RxDB import, Vercel or credential mutation. Prior dev/main snapshot a9c5192a / b952f71e was historical, not rechecked this task.
- Existing two Supabase Security Advisor WARNs are confirmed for exposed SECURITY DEFINER CAS RPCs. Not waived.

## Work
- Add a node-only signed Auth/Data API denial-path probe fixed to the isolated Singapore mosaic-dev origin. An operator must supply two verified disposable Auth users and a public API key locally; no secret keys or hardcoded account credentials.
- Probe performs real sign-in and server Auth /user verification, owner and wrong-owner SELECT, denied direct table UPDATE/DELETE, denied anonymous SELECT/RPC, missing-row CAS conflict, and unapproved field rejection without intentionally persisting rows.
- Add Vitest mock-HTTP regressions and a documented opt-in npm command. No browser bundle or production backend changes.
- Read-only management inspection confirmed both privileged RPC definitions use auth.uid owner predicates, non-null checks, fixed empty search_path, and patch allowlists. Those properties do not resolve the security warnings.

## Verification
- Local Node simulation of equivalent probe scenarios passed 3/3 tests (not an exact checked-out repo CI run). Project's canonical Vitest and remote Actions checks remain pending.
- No live signed-user proof: connector cannot create/sign in Auth test accounts and neither disposable credential was available. Empty-table wrong-owner queries are not positive isolation proof.

## Next action
- Verify task source diff and request focused CI using [verify:focused]. Repair any failures; then squash the coherent task into an isolated stable Preview branch and run canonical and trusted Preview gates if available. Keep #967 open.
- To obtain actual signed HTTP evidence, provision two confirmed disposable Auth users in mosaic-dev using an authorized channel, set the six local MOSAIC_SB_PROBE_* environment variables without recording passwords, run npm run supabase:auth:probe, and record sanitized result. After that, add synthetic owner-owned fixture/RLS positive proof and concurrent CAS tests, then RxDB offline replay. No Supabase production/app/provider switch, or dev/main/1.0 release without distinct owner approval.
