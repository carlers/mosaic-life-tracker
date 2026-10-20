# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 hosted Supabase core verification, accepted version 0.32.0.

## Source and boundary
- Baseline: `refactor/1027-supabase-core-app-20261020@052a4658b55e25bc5b34a416c923fe604f0a3339`, PR #1079. Canonical #39412036803, local Supabase lab #39412036661 and trusted Preview #39412277835 passed. Full evidence: #1027 comment 6289391812.
- Task `codex/1027-supabase-hosted-20261020`, PR #1096 → `refactor/1027-supabase-hosted-20261020`. Version impact NONE: verification/tooling only.
- No Production, real-user migration, dev/main promotion or 1.0. Ordinary Preview still selects Appwrite; hosted browser verification uses an explicit core-only build on loopback, not a deployed Supabase Preview.

## Hosted implementation
- Exact isolated target: healthy `mosaic-dev`, `hcxtiifzxoaflhjgoglb`. Environment token now permits database, keys, advisors and Auth policy readback (200 after user updated permissions). Email confirmation required; refresh rotation enabled, reuse interval 10 seconds, JWT expiry 3600 seconds. Leaked-password protection remains disabled; no Auth policy was changed.
- Verified the seven-migration empty baseline before transactionally installing accepted protected-fields/fresh-authority SQL as `20261020130000` / `20261020130001`; exact stored statements matched source. Never rerun empty-project rollout or enroll existing users implicitly.
- `supabase-poc/hosted-core.mjs` defaults to inspection. Explicit probes use signed disposable owners for RLS/CAS/session/epoch/lease denials. Cleanup tombstones rows, freezes authority and bans accounts, with readback. Admin keys are restricted to fixture Auth operations.
- `hosted-core-ui.mjs` builds the actual app with the public key and runs the expanded browser contract. No management/admin credentials enter build/browser children. Runbook: `supabase-poc/HOSTED_CORE.md`.

## Verification
- Hosted `--ui` run `defe11f80a976cb7fa409fb5` PASSED, including retirement: four verified users, 25 denied writes, two CAS winners/two conflicts, five guard cases, five cleanup tombstones and four retired accounts, no live fixture rows. Browser test passed in 2.2 minutes: tasks/categories, Calendar/Day View, Backlogs, ordering, offline completion/deletion replay, second-device convergence and owner isolation.
- Prior 15-second hosted category assertion timed out. Bounded 45-second hosted default passed with every assertion preserved; local limits unchanged. Failure diagnostics now include request method/path/status and redact disposable secrets.
- Playwright proxy loopback uses its supported override. User explicitly approved the proxy CA import; Chromium also needs writable NSS initialization access. Hosted HTTPS verification stayed enabled.
- After restart, exact interrupted cohort `ec9374be46eb9a23b5749ae4` was recovered; all preceding 22 fixture accounts were frozen/banned, zero live rows. Credential/recovery checkpoint: #1027 comment 6292342917.
- Head `3c3f9b8e` passed focused #39430295855 and real local-stack lab #39430296005. Final tooling head `51fc6b32` passed hosted browser, four harness unit tests, lint/contracts/discovery; remote focused #39433888135 failed only the checkpoint's 3000-token handoff budget. This repair shortens the checkpoint; detailed history stays on #1027. PR #1096 is not yet merged.

## Next action and remaining gates
- Finish repaired focused CI + local-stack lab, squash PR #1096 to its named stable branch, then canonical/trusted delivery. Record exact SHAs/runs in #1027; no status-only post-green commit.
- Complete offline cold-start/expired-token/cross-tab recovery, conflict UI, existing-user Appwrite fencing, three-backend forward/reverse migration preserving pending edits/tombstones, encrypted DR, hosted Preview build-input parity and manual devices.
- Vercel/Appwrite/Oracle management access is not established; inspect readiness before infrastructure work. Resolve leaked-password protection before release acceptance. Keep #1027/#967 open; Diary #1029 immediately follows the working core release.
