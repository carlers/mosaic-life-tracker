# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #1027 reconstruct protected Preview email-code repair from Codex transcript.

## Source and safety
- Accepted isolated branch baseline `feature/1027-supabase-recovery-20261020@9391e99038276c897235732d0a07cd0e574442b6`, v0.32.3. Prior canonical #39474239790 and hosted core lab #39474239853 green **for unsafe fragment-template baseline only**. These do not certify this reconstruction.
- Original Codex repair was uncommitted and its VM expired. The archived transcript supported an independent reimplementation; it was not a byte-for-byte restoration.
- Real deployed isolated Preview remains protected v0.32.1 `mosaic-supabase-core-preview.vercel.app` / `dpl_CSBQtqBXqz2naXLx3bS73rE4UTAR` unless separately verified. Do NOT deploy unsafe `9391e990` email templates, promote dev/main/Production, migrate user data, alter SSO, or release 1.0. Appwrite Scratch suspended; Oracle unprovisioned. Keep #1027/#967 open, Diary #1029 next after a usable core release.

## Implemented in this task
- Supabase email verification routes now accept **email + 6–10 digit OTP** from a visible user form when navigated without a fragment, rather than carrying a one-time credential through Vercel SSO. The GoTrue verification request places `email`, `token` and `type` only in the POST body. Its temporary bearer is never written to storage, validated via live Auth user endpoint and matched to the typed email before password updates or confirmation.
- Existing legacy hash callback compatibility is retained solely for previously issued tokens, with original early fragment cleanup, stale callback fencing and temporary-session-only logout.
- `email-policy.mjs` templates display `{{ .Token }}` in the email body; hrefs are exactly the clean `/auth/confirm` or `/reset-password` route. A fail-closed policy guard rejects credential-bearing redirects and missing code markers before Auth-config mutation.
- Runner fixtures require a server-generated `email_otp` from an exact server-marked disposable account, redact both token hash and code in child logs, and run clean-link email tests with replay, writer and referrer/query leak assertions. Reconstructed unit/DOM/policy tests cover the code path.
- Hosted `mosaic-dev` and Vercel email policy **have not been changed** in this task. The untracked external operator deployment helper originally changed by Codex is not contained in this repository or recovered automatically. Deploy only after an independently audited trusted exact-artifact helper has the clean-template-before-mutation guard.

## Verification
- First focused Quality Gate #39538463774 failed on the checkpoint heading contract; this repair restores the required heading without changing the check.

## Next action
- Task `chatgpt/1027-prebuilt-artifact-staging-20261021`: offline-only exact GitHub artifact→Vercel v3 stage, never deploy/alias/policy. First focused #39541175235 failed on checkpoint length; reduce it without weakening tests. Prior source `846145a4` passed canonical #39539940796 and Supabase lab #39539940657; artifact #12319471470. New source SHA needs new acceptance.

- PR #1141 reconstructed the lost Codex repair and merged at `c0b4ddb2`. Focused #39538614099 passed; canonical #39538736836 exposed double-escaped email/OTP regex literals. PR #1142 fixed these at stable `48d6acfb`; focused #39539012299 passed. Canonical #39539139399 caught a new *test assertion* expecting exact-route rejection for `token_hash`, which correctly triggers the earlier code-only guard. This task instead tests a generic URL fragment plus explicit `token_hash` and `TokenHash` rejection. Re-run focused, then squash this task into isolated stable Preview; require new full canonical and Supabase lab success at exact SHA.
- Historical Codex hosted run `ff73923158367002a1923739` is **not** evidence for reconstructed source. Deploy only new accepted CI artifact and verify credential-free email policy/readback, old alias safety, disposable real UI/email tests, and revocation. External Codex operator script was not recovered; do not bypass its expected SSO/template checks. No hosted Auth or alias change yet.
- Remaining beyond this repair: public email delivery/signup, phone PWA, trusted Appwrite old-client cutoff, reversible three-backend transfer with offline tombstones and tested DR. Never promote dev/main/Production or migrate real users without separate approval.
