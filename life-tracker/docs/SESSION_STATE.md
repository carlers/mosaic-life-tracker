# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 Supabase recovery and isolated Preview, v0.32.1.

## Scope and source
- Baseline `refactor/1027-supabase-hosted-20261020@1bb2521c`, PR #1096: canonical, real lab and trusted Preview passed. Full resume: #1027 comment 6292548078.
- Task `codex/1027-supabase-recovery-20261020`, PR #1103 → `feature/1027-supabase-recovery-20261020`. PATCH 0.32.1. Unrelated dev is 0.34.4; future promotion needs version/integration reconciliation.
- No Production, real-user migration, dev/main promotion or 1.0. Keep #1027/#967 open; Diary #1029 follows core release.

## Implementation
- Expired-token recovery pauses both local writers before rotating credentials, retaining the server lease. Verified same-owner rotation precedes original lease release and guarded restart. Ambiguous failure retains drafts/credentials and permits bounded retry; denied refresh or uncertain cancellation blocks replacement writers. Terminal recovery requires reload/sign-in.
- Lease release is bound to the original owner; late refresh completion after provider unmount stops the new writer. GoTrue numeric `code` plus symbolic `error_code` is handled.
- Disposable local lab uses real 60-second JWTs. Hosted Auth policy is unchanged. Browser test verifies server expiry, failed first refresh, retry and second-device convergence.
- Separate public-input Supabase CI artifact follows the real lab. Exact source/provider/origin/key-digest, archive inventory and routing are verified; ordinary Appwrite receiver rejects it. Hosted UI can test deployed bytes with exact source/provider checks before login. Runbook: `supabase-poc/HOSTED_CORE.md`.

## Evidence and current repair
- Recovery `df574b72`: focused #39440410286 and real lab #39440410258 passed, including three browser/server cases.
- Combined focused #39441461446: 2110 tests passed; checkpoint length failed. This repair shortens the handoff. Supabase build/PWA/blocking sizes and reconstruction of 175 static files passed locally.
- Lab #39441461417 intermittently failed post-refresh replay. Expiry setup now waits for initial push acknowledgement; server insert alone can race it. Added bounded request diagnostics; no relaxed replay assertion/deadline. Repeat must pass before deployment.
- Hosted baseline UI/security run `defe11f80a976cb7fa409fb5` passed; all four disposable users retired, no live fixture rows. Never rerun empty-project rollout.

## Next action
- Only Supabase target: mosaic-dev / `hcxtiifzxoaflhjgoglb`. Management/Auth readback works; confirmation and refresh rotation enabled, leaked-password protection disabled.
- Vercel token/project readback works. Planned isolated alias `mosaic-supabase-core-preview.vercel.app` was unassigned. Its environment allowlist draft needs user publication. No deployment claimed. Preserve shared Vercel variables/protection/aliases.
- Scratch Appwrite `6a96e82d000d1310b3be` is suspended after free-tier exhaustion. Oracle VM/endpoint/project are unprovisioned. Do not request unavailable credentials or substitute Production.
- Complete final focused/lab/artifact checks, squash PR #1103 only after green, then stable canonical acceptance. Deploy exact Supabase CI bytes and verify hosted UI/retirement when hostname access is available. Record remote evidence in #1027; no status-only post-green commit.
- Remaining MVP: persistent offline cold-start/cross-tab recovery, conflict UI, old Appwrite writer fencing/identity mapping, reversible three-backend transfers preserving drafts/tombstones/revisions, encrypted restore and mobile acceptance. Live migration tests await functioning Scratch and Oracle.
