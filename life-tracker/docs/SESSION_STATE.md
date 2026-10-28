# Session checkpoint
Updated: 2026-10-28 Asia/Manila
Current task: #1027 temporary invitation for user-controlled disposable Gmail, safe beta-invite signup feedback; Production not approved.

## Current accepted evidence
- Stable isolated recovery `feature/1027-supabase-recovery-20261020@d44dff3cb138adaf7b2b145174d65557d7f35230`, exact canonical Quality #40713752562 SUCCESS, Core App signed UI/six-domain/second-device/invite synthetic tests and protected Preview deploy workflow #40713752653 SUCCESS. Preview `https://mosaic-life-tracker-7q1qsphwj-carls-projects-72516fde.vercel.app` READY and owner confirmed signup screen loads on phone; no signed personal/live email acceptance yet. dev, main and Production unchanged.
- At 2026-10-28 15:49Z the owner's real disposable-address browser signup returned HTTP 403. Supabase auth_logs prove the configured `beta_before_user_created` hook rejected the request: `Registration is by invitation only.` (two requests). CORS preflight HTTP 200; zero new unmarked Auth users. Not an SMTP or password error. The app previously hid this as `Account creation could not be completed.`.
- One exact short-lived four-hour beta invitation was safely inserted for only the disposable address visibly submitted in the user-provided image. Verified active invite exists (total active count went 2 → 3), no matching existing Auth account, zero release evidence, and no general signup access expansion. **Do not place test address, codes, passwords or tokens in GitHub/CI logs/issues.** User may retry on the already accepted immutable Preview. Do not repeat the invite or change global Auth hook.
- Hosted `mosaic-dev` remains 21 migrations, zero real-user release consent, no installation release marker or installed final personal-writer fence. Protected signed post-registry two-owner #40679406417 attempt 2 and protected read-only SMTP configuration #40713752804 PASS; actual Gmail and Proton inbox/code receipt still untested. Preserve independently restored immutable R2 BEFORE `20261028T053525682Z` and AFTER `20261028T100954899Z`: no recapture/restore/prune.

## Source change
- Isolated task branch `chatgpt/1027-signup-invite-feedback-20261028`: recognize only the exact static GoTrue signup 403 invitation-hook message in `candidateAuthSession.ts` as a typed `CandidateSignupInvitationRequiredError` without exposing raw provider response. `SupabaseAuthProvider` gives a fixed instruction to use an invited email; any other 403/network/server failure stays generic. No new auth requests, public access or account-enumeration messaging.
- Unit tests cover all known GoTrue message field variants, unrelated/invalid bodies, non-signup 403, unchanged session state and sensitive error nondisclosure. Component tests check typed signup denial and generic handling. Candidate Preview version `0.48.1` PATCH from accepted 0.48.0; version, package and lockfile must match.
- Run task focused checks, squash into isolated recovery, require exact-SHA full canonical + specialist CI. Protected Vercel Preview for the *new* SHA needs **separate owner approval**; do not auto-promote dev/main/Production.

## Next action
Accept task CI, repair as needed, preserve old accepted Preview until refreshed, and get owner report whether disposable Gmail signup/confirmation works. Then test controlled Proton confirmation and both password-reset inbox flows. Verify generated user/consent/release state read-only; do not activate final writer fence or release marker without independent old-PWA/offline/real-user authorization and explicit Production approval.

Issue: https://github.com/carlers/mosaic-life-tracker/issues/1027
