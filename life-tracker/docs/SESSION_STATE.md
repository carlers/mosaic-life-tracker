# Session checkpoint

Updated: 2026-10-16 UTC
Current task: #889 DR restore-fidelity stable Preview delivery after #592/#914 trusted producer change.

## Current verified state
- Owner merged infrastructure-only #919 to protected `main@1f146ba7e935a1f2595c176ca21f41413698d2c0`. Ruleset #24880070 is active with zero bypass actors and unchanged required PR preflight. Exact main Production Vercel deployment `dpl_3fS5n8JbG2QaVH9GgNistHpqT7EV` is READY; Product remains v0.17.4, Production backend remains unmodified. Main Quality Gate #38873787926 first attempt failed only the unchanged cross-category drag browser contracts; failed-jobs-only rerun requested, outcome must be rechecked. Do not reuse a mixed-attempt Quality Gate artifact for PREBUILT delivery.
- Protected `dev@dff508fb30c7db069fc753cd09359627242a3ffb` v0.29.1 includes #914 Phase A; no #889 DR fidelity fix yet. `main` now has a security-only change not yet reconciled into dev. #909 remains blocked.
- Original isolated `fix/889-dr-recovery-dev-20261016@69dff37905e42be3bc3423790afede62a9726aee` includes nullable-integer-default DR restore fidelity, regression tests and runbooks; focused #38865174720 and full canonical #38865387907 SUCCESS. The prior trusted Preview receiver #38865616797 failed closed only because protected main did not yet recognize #914's exact reviewed Quality Gate blob.
- Authenticated isolated DR exact backup restore (6 users, 2,924 rows, 137 files), owner-accepted 010–015 upgraded DR rehearsal and isolated current-app browser acceptance are established evidence, not Production migration approval.

## Current isolated task
- Task `chatgpt/889-dr-trusted-preview-20261016` branches from the existing DR stable source. Copy the **three exact reviewed** #919 main security code/test/runbook blobs into that source, with this checkpoint; do not edit UI, Function code, Appwrite schema, service settings or version. This re-delivers the existing DR fix using main-trusted code without broadening trust to other Quality Gate blobs.
- Before stable delivery, require focused source CI, diff review, a squash PR into the same isolated `fix/889-dr-recovery-dev-20261016` branch, a fresh full first-attempt canonical gate, and a separately verified CI-first trusted Preview. If browser test flakes, investigate; never claim mixed-attempt PREBUILT evidence as equivalent.
- Do not automatically merge into protected `dev`. After stable proof, separately obtain owner permission for stable→dev promotion and reconcile new main security ancestry to dev before proposing #909 release. Preserve protected branch rules.

## Production release gates remain closed
- Confirm each old owner-installed v0.17.4 browser/PWA has fully synced and been closed/updated/reinstalled/retired, with no old offline queued changes. General #914 checks do not retrofit old JS.
- Separately approve target-confirmed **Production** migrations 010–015, then separately approve Production `message-action` build/activation while retaining schedules, secrets and prior READY deployment.
- Complete real Production two-account, Diary, photos, chat, notifications, Sync Now, offline/mobile/PWA and privacy acceptance, then separately approve dev→main pre-1.0 release. Do not tag 1.0.0.

## Next action
- Require task focused CI success; squash the verified task into the existing isolated DR stable Preview branch, then check fresh full canonical acceptance and trusted CI-first Vercel delivery for its exact source SHA. Independently recheck protected main's canonical attempt-2 result.
- Keep stable→dev promotion subject to separate owner authorization, reconcile main ancestry, and preserve all #889 Production safety gates.
