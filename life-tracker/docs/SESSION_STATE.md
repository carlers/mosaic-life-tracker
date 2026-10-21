# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #1027 zero-cost new-account Supabase core beta email/readiness preflight; Preview v0.32.4.

## Baseline and constraints
- Accepted isolated stable source `feature/1027-supabase-recovery-20261020@70d7485b06c0004769f03b0ad96189669777f05a`, v0.32.4. Quality Gate #39553399157 and signed Supabase Core App Lab #39553398961 passed, artifact #12324896461.
- Immutable Vercel Preview `https://mosaic-life-tracker-6luuatyml-carls-projects-72516fde.vercel.app` is READY as deployment `dpl_8wEHnC6mxEnie9wrrg9TWkHDjSvg`. User confirmed clean cold confirmation/recovery pages. The old `https://mosaic-supabase-core-preview.vercel.app` alias remains on a different protected deployment; neither alias nor production was changed.
- Hosted disposable signed email+core UI tests passed on local built frontend (issue #1027 checkpoint); generated OTPs did **not** prove SMTP delivery, actual hosted immutable URL session or physical PWA.
- User reports Brevo Free SMTP/transactional account activated. This is **not** evidence that mosaic-dev Supabase custom SMTP or actual sender/delivery works. Strict $0 cost only; no paid domain or plan, no existing-user Appwrite migration, no dev/main or Production promotion.

## Implementation
- This task branch switches source-side code-only Auth templates/redirects to the independently accepted immutable v0.32.4 Preview instead of the stale alias; rejects old alias in email Auth-policy preflight.
- Adds secret-free Brevo relay/sender configuration booleans to read-only Auth policy inspection and regression checks, plus focused runbook instructions. No provider mutation, mail send, Vercel protection/alias edit or service credential use.

## Verification
- Local and remote tests, exact new task commit SHA, focused CI and canonical CI remain to be recorded after committing. Existing stable v0.32.4 acceptance does **not** certify this new script change until new verification succeeds.

## Next action
- Run focused verification for task commit; then stable-Preview canonical acceptance/delivery workflow if appropriate. Preserve old accepted deployed bytes until a new accepted user-visible build is necessary.
- For isolated `mosaic-dev` only, user securely enters Brevo SMTP settings in Supabase dashboard; re-inspect sanitized policy and review exact site/redirect/code-only email templates before any authorized configuration write.
- Verify delivered confirmation and recovery emails with controlled recipient, SSO/share access, actual signed hosted immutable browser, offline/replay and physical Android/iOS. Review security advisors, project/email free quotas before invite-only beta signups.
- Returning Appwrite accounts require separately authorized migration, writer cutoff, mapping, encrypted export/restore and rollback. Keep #1027/#967 open; Diary #1029 follows core launch.
