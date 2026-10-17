# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 slow-network startup; owner approved execution after specifying that the prolonged screen is **“Mosaic — Opening your local data…”**, before Home mounts.

## Live baseline / protected boundaries

- Protected `dev@b0c703636c8c6e8d52c6dd3c59ebc0251070ab7e` = v0.29.5, post-merge Quality Gate #39009170682 SUCCESS, Vercel dev READY. Production `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` = released v0.29.1. Do not promote to dev/main or release 1.0 without explicit approval.
- #745 accepted-in-dev Chat Sync fix has live-device regression still outstanding; #936 mandatory pre-1.0 security/privacy audit remains planning-only; #914 changed-backend/authorization rollback gate remains open. Preserve all.
- Official Preview/dev use Scratch Appwrite only. No backend/schema changes in #858.

## #858 source assessment and isolated task scope

- `AppLayout.LocalDataStartupShell` has two distinct mount reasons: **(1)** local RxDB module/open/collections not ready, **(2)** an uncached `AppDataShell` lazy module not resolved. It is not gated on `account.get()`; the existing cached identity is usable locally, while remote session verification and sync proceed separately.
- 2026-10-17 CI production build evidence: `database` chunk roughly 129.8 KB gzip, `AppDataShell` 8.4 KB gzip and `HomePage` 14.1 KB gzip. Cold/uncached network latency is plausible but not yet measured or established as the owner's exact cause.
- Active isolated task `chatgpt/858-startup-diagnostics-20261017`, stable Preview `perf/858-startup-diagnostics-20261017`, both branched from exact dev SHA. Instrument distinct application-shell import and fallback stages using existing non-sensitive Performance marks, add browser contract that holds Appwrite requests unresolved until Home's actual local calendar/owner-data appear, and extend synthetic mobile-startup diagnostics with per-stage timings. No UI layout, auth, DB semantics, Appwrite, security-policy or version changes; version impact NONE for diagnostic-only phase.
- Existing `audit:mobile-startup` uses a synthetic owner and deliberately blocks real Appwrite; a passing browser contract is **not** evidence of physical-device slow network performance or of an installed PWA cache hit. Correct root-cause optimization is reserved for per-stage evidence.

## Execution / handoff

- Complete focused CI for task checkpoint (`[verify:focused]`), then squash to stable Preview; require full canonical acceptance, trusted Preview + Vercel READY before device testing. Fix actual CI failures. Record exact commits, CI, source parity.
- Owner still needs to reproduce on stable Preview with slow internet and collect the existing `mosaic:database:*`, `mosaic:app-shell:*` and `mosaic:home:*` Performance marks; compare app JS cache state. The next change should target whichever phase is slow. Do not claim a performance fix or manual acceptance before measurement.
