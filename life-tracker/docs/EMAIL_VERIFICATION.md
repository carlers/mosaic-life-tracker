# Oracle transactional email and optional verification (#1745)

## Live evidence and scope

On 2026-11-04 the owner completed an Oracle SMTP-only guarded host transaction
(`MOSAIC_SMTP_HOST_COMMIT=PASS`), HTTPS health check PASS, and disposable Oracle
Scratch password-recovery end-to-end acceptance: email arrived, reset worked,
new password logged in, old password and reused link were rejected. These
are owner-reported manual acceptance outcomes, not independent test telemetry.

Brevo connector reports `mosaic.carlers.is-a.dev` authenticated and verified,
SMTP relay enabled and `no-reply@mosaic.carlers.is-a.dev` sender active.
Independently verify mail authentication headers (DKIM/DMARC alignment) before
claiming header-level delivery authentication. Never put SMTP credentials or
recovery/verification links in chat, Git, CI, logs or support screenshots.

## Verification feature (v0.83.1 Preview refinement)

- Login and required-username signup are unchanged. User enters Mosaic after
  signup without waiting for email. Verification is optional; existing accounts
  and all preexisting stored data remain accessible.
- Immediately after a successful unverified signup, a dismissible one-time
  verification sheet appears over the workspace with one sentence explaining
  why confirming email ownership matters. A user may send verification now
  or select **Maybe later**; neither path changes authenticated workspace access.
  The prompt never sends without consent, is scoped to the signed-in owner,
  and is not persisted or replayed on login/reload/account switching. Sending
  uses the existing live-owner checks and Appwrite rate limits; Settings remains
  the permanent resend entry point.
- Go to **Settings > Account > Account email**. The sheet refreshes the server
  account via `account.get()` and displays verified/unverified/unavailable.
  Send verification only if the live user is unverified. The UI applies a
  60-second cooldown after success; Appwrite retains authoritative rate limits.
- The email link returns to the **current** registered browser origin at
  `/verify-email`. The page erases query parameters before an asynchronous
  request, prevents duplicate calls under React StrictMode, consumes the
  `userId` and `secret` only in memory, does not print/store/log them,
  and rejects a link belonging to another signed-in account.
- A status refresh is rechecked against the current server session before send.
  Stale cached identities and account switches cannot redeem another owner's token.
- The callback may complete signed out when supported by Appwrite. It does
  not create a session. If a different user is signed in, sign out then
  reopen the email link. After success on the same current user, refresh the
  server account record with generation fencing; never overwrite an unrelated
  offline/cached owner. Expired/reused links present generic messages.
- Email changes via the existing password-confirmed flow reset verification
  status in Appwrite. Reopening the account sheet fetches current status and
  permits a new verification request.
- No schema, Function, mail-provider, SMTP, Production access-policy, origin
  allowlist or role permission changes are part of this frontend feature.

## Release and acceptance gates

1. Run focused AuthProvider/verification DOM tests, typecheck, lint, PWA build,
   and project version contract (package, lock and appVersion).
2. Use standard `chatgpt/**` focused CI and squash into an authorized
   `feature/**` stable Preview branch. Accept only canonical full Quality
   Gate SUCCESS, official Vercel READY and Scratch backend identity
   `6ae94a2100014d01f5ed`. Register the exact Preview hostname in Scratch
   Appwrite Web platforms if it is not already covered; **never** widen
   Production origins for Preview.
3. In a disposable Scratch account: signup and immediate workspace access;
   first email request and inbox delivery; correct callback origin; successful
   verification; reopen sheet to see verified status; existing verified
   account does not resend; change email and see unverified status; resend
   cooldown and server 429 behavior; second browser/signout and wrong-account,
   expired/reused link handling; password recovery regression; mobile PWA
   navigation and offline behavior. No real-user credentials.
4. Production synthetic recovery is a **separately approved** create/reset/
   login/delete sequence against exact Production project
   `6ae9599c002ab812f9c3`, using the official main origin only. Never
   test Production through a Preview app.
5. Require explicit Preview->dev and dev->main approvals and existing canonical
   delivery gates. Close #1745 only after accepted scope and evidence.

## Operator caution

Do not rerun the SMTP-only operator after a successful host commit or open
SSH ingress beyond the existing owner IPv4 /32. Clean up the temporary owner
NSG only when recovery access is no longer necessary, following the
separate SSH/OCI runbook. Retain DR and original sender records.
