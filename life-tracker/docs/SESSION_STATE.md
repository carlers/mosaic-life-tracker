# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #1027 zero-cost fresh-account Supabase core beta.

## Baseline
- Stable isolated source: `feature/1027-supabase-recovery-20261020@12f343895efa7810e2bbf626900e121cbcb71c78`, v0.32.4. Quality Gate #39577588073 and signed Core App Lab #39577588135 SUCCESS, including real local invitation-hook SQL decisions, catalog privileges, signed browser core and CI artifact staging.
- Vercel immutable protected Preview `dpl_8wEHnC6mxEnie9wrrg9TWkHDjSvg` built from `70d7485b06c0004769f03b0ad96189669777f05a`. No public alias or exception approved.
- `mosaic-dev` `hcxtiifzxoaflhjgoglb` healthy and Free. Approved SMTP/OTP Auth policy inspected twice with all 7 flags true. User verified real Gmail confirmation, sign-in and password recovery; one recent confirmed/signed-in Auth user independently counted. Proton recipient delivery remains unresolved despite Brevo Delivered. Brevo Free relay and sender active, 295 reported send credits last checked; connected plugin does not expose delivery events or DNS/IP-security settings.
- Public signup still enabled at Auth layer; Vercel page SSO alone is not invitation enforcement. No migration or hook is installed on hosted `mosaic-dev`. Zero active candidate task/category rows in latest readback. Existing Appwrite, Production, dev/main untouched.

## Implemented, source-only
- PR #1175 staged an unapplied private exact-email invitation table with expiry/revocation and fail-closed GoTrue Before User Created function. No client metadata bypass; no real invite addresses.
- PRs #1178/#1180 added actual disposable PostgreSQL invite decisions and catalog access tests to signed local CI; repaired forbidden `SET ROLE` impersonation without broadening database grants. Stable signed lab and Quality Gate SUCCESS.
- Current task branch introduces a *second fresh local Supabase CLI stack after the signed UI lab*, with staged hook enabled **only locally**; synthetic invited/uninvited/expired/revoked GoTrue signup, invited admin fixture and Auth row count. No real mail or service/provider mutation. CI pending on this follow-up. Its first focused run #39578932521 failed solely because this checkpoint exceeded the required 3000-token budget; trimmed here without weakening verification.

## Next action and blockers
- Verify focused test, squash into isolated feature branch, await full canonical and signed local GoTrue lab. Resolve lab failures without disabling security checks.
- Before hosted installation/activation obtain separate explicit approval, positive/negative real GoTrue and admin fixture proof, signed reviewer acceptance and rollback. Keep SSO protected until invite enforcement and scope-specific public alias separately approved.
- Deployed signed `--ui-preview` requires operator-private Supabase PAT + Vercel share; Android/iOS installed PWA, offline/restart, two-device task/category sync, security review, DR/quotas and Proton deliverability remain unaccepted.
- Keep #1027/#967 open; Diary #1029 next. $0 only, no real-user Appwrite migration, dev/main, Production or 1.0 promotion.
