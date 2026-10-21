# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #1027 protected immutable Supabase fresh-account browser acceptance automation.

## Baseline and constraints
- Stable isolated feature source before this task: `feature/1027-supabase-recovery-20261020@69d20eff3ec34a3de0039a44c272ce5014400a1b`, v0.32.4. Full canonical #39560877421 and signed local-stack Supabase Core App Lab #39560877431 successful. No open #1027 PRs at task start.
- Existing protected immutable Preview remains READY at `https://mosaic-life-tracker-6luuatyml-carls-projects-72516fde.vercel.app`, deployed exact `70d7485b06c0004769f03b0ad96189669777f05a`. Read-only SSO-bypass fetch independently confirmed 200 at /login, /auth/confirm, /reset-password; unknown path 404; embedded build identity exactly matches Preview, supabase-cloud, core-only and SHA.
- `mosaic-dev` is Supabase Free. Brevo Free account activation reported by user but Supabase SMTP connection, actual email delivery and Auth policy still unverified. $0-only; no paid domain, Production, dev/main, Appwrite/real-user migration or 1.0 authorization.

## Implementation
- Add pinned deployed build identity and strict scope-specific `_vercel_share` URL validator; reject arbitrary hosts, hashes, callback tokens, query params and stale alias **before** hosted browser fixtures are created.
- Extend signed hosted core and email OTP runner CLI with `--ui-preview` to exercise the accepted immutable deployment (not a rebuild). Use each Playwright BrowserContext's shared request cookie jar to exchange temporary share access privately, then navigate clean app paths; redact share URL diagnostics. Retain provider isolation, tombstone/ban fixture retirement, generated OTPs and other offline/local tests.
- Unit test the strict preview identity/share-link preflight; document operator-only commands. No publishable runtime change, Vercel alias/protection, hosted Auth policy, Brevo SMTP, Production or real-user mutation.

## Verification
- Pending focused Quality Gate and stable feature canonical acceptance on the new task commit. Prior stable v0.32.4 deployment acceptance remains independent; **new deployed-browser modes are not yet executed** and may need refinements when a real scoped share link and operator-held Supabase Management token are provided.

## Next action
- Run focused quality at exact task SHA, repair and squash into isolated feature branch, obtain full canonical/lab acceptance. Keep deployed v0.32.4 artifact intact; operator uses a private ephemeral Vercel share URL plus local Supabase PAT to run deployed real signed core and generated-OTP confirmation/recovery on the exact app.
- Configure private Brevo SMTP only in `mosaic-dev` Auth dashboard, inspect sanitized policy, review approved OTP-only templates/site/redirect, then controlled real-mailbox signup/recovery/delivery. Free public beta access needs a scoped, explicitly approved permanent Preview exception/alias after risk review; do not expose shared project or old Appwrite users automatically.
- Complete physical Android/iOS PWA, offline/return and quota/risk reviews; #1027/#967 stay open, Diary #1029 next after usable core.
