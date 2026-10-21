# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #1027 zero-cost fresh-account beta admission preparation, Brevo connected.

## Accepted baseline
- Stable isolated Supabase feature `feature/1027-supabase-recovery-20261020@4232523eb809e482663b8746a2ebc5c8a8368324`, v0.32.4. Full canonical #39563102384 and signed local-stack Supabase Core App Lab #39563102461 passed.
- Protected immutable Vercel Preview `dpl_8wEHnC6mxEnie9wrrg9TWkHDjSvg` serves exact accepted built source `70d7485b06c0004769f03b0ad96189669777f05a`; no public alias/exception approved.
- User-approved isolated `mosaic-dev` Auth SMTP and OTP code-only site/redirect/template policy applied, two sanitized inspections passed all 7 checks. User confirmed **Gmail** real confirmation, sign-in and password recovery; read-only Auth aggregate found one recent confirmed/signed-in account. Proton messages remain missing after Brevo reports Delivered; do not generalize Gmail deliverability.
- Newly connected Brevo readback: transactional relay enabled, active Mosaic sender, account on Free plan, 295 reported send credits at observation. Connector does not expose transaction logs, SMTP IP allowlist changes or DKIM/DMARC verification. No paid plan or sender changes.
- Supabase project `hcxtiifzxoaflhjgoglb` healthy Free; public signup currently permitted at Auth layer. Vercel project has SSO deployment protection. Isolated app builds are NOT a Production migration.

## Source-only work for this task
- New **unapplied** candidate migration `supabase-poc/migrations/20261021_beta_signup_invite_gate.sql`: private normalized-email, max-30-day expiring/revocable allowlist, server-only fail-closed GoTrue Before User Created decision. No metadata/header/admin bypass, function fixed search_path, no table API grants.
- Synthetic transaction-rollback probe in `supabase-poc/validation/20261021_beta_signup_invite_probe.sql`, source-level security assertions in `tests/unit/supabaseBetaSignupAdmission.test.ts`, operator guide in `supabase-poc/HOSTED_CORE.md`.
- No live schema migration, hook activation, invitations, email sends, Auth write, Vercel public exposure, old Appwrite user migration or dev/main/Production mutation.
- First task focused #39575300544 passed, stable canonical Quality Gate #39575444090 passed on second attempt after an unrelated chat-scroll timeout, and signed local Supabase Core App Lab #39575444075 passed at ae3336f. The candidate invite SQL was not yet executed in that lab, and actual GoTrue hook dispatch remains UNVERIFIED. This follow-up adds a disposable SQL/role probe to the lab; its new focused/canonical/lab checks are pending.

## Next action
- Verify disposable SQL/role probe in updated Supabase Core App Lab and still separately test actual GoTrue Before User Created dispatch plus HTTP signup acceptance/denial. The current disposable admin fixture lab may be blocked by hook: design safe temporary fixture invitations before production-like hook activation. Staged schema/hook enablement need separate explicit approval.
- Run signed immutable deployed `--ui-preview` core/OTP and physical Android/iOS offline/restart tests; verify task/category sync, two owner isolation and stable fresh signup. Protected Preview share link and operator-held Supabase Management token remain private.
- Review Free quota, Brevo sender authentication for Proton, PWA service worker, rollback/DR and abuse controls. A scoped stable Preview alias and any public Vercel exception require explicit approval and enforceable server invitation gate first.
- Keep #1027/#967 open. Diary #1029 follows accepted core beta. No paid services, dev/main, Production, 1.0 or existing-user cutover approved.
