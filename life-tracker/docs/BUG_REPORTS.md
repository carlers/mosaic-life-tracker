# Public GitHub bug reporting — issue #854

## Consent and scope
Settings → About Mosaic → Report a bug publishes an issue to the public
GitHub repository carlers/mosaic-life-tracker only after the signed-in user
checks a required, per-submission public-consent checkbox. The form previews
the title, description and reproduction steps that will be public. Editing
those fields clears consent. Existing client action submit_bug_report still
stores private reports and will never retroactively publish them.

Public GitHub Issues can be read, searched, copied and archived by anyone.
They do not disappear after 30 days or automatically disappear when the Mosaic
account is deleted. Do not publish personal data, tasks, diary entries, chat,
passwords or secrets. The server does not publish identity, account IDs,
emails, full URLs, optional device diagnostics or private attachments.
Diagnostics stay in the private Appwrite bug_reports table.

The new publish_bug_report action requires authenticated Mosaic caller,
publicConsent true, and five-per-hour rate limiting per caller. It returns
the real issue URL upon confirmed creation, with a private report receipt.

## Server configuration
Publishing is disabled by default. The message-action Function requires:
- GITHUB_BUG_REPORT_ENABLED=true
- GITHUB_BUG_REPORT_TOKEN=an operator-provisioned fine-grained PAT with
  Issues: read/write restricted to carlers/mosaic-life-tracker ONLY.

Never put credentials in frontend code, public GitHub content, CI output or
ChatGPT chat. Use GitHub Settings → Developer settings → Personal access tokens
→ Fine-grained tokens to create a short-expiry token. Set the two variables
securely in Scratch Appwrite Console → Functions → message-action → Variables.
If Function changes require redeployment, redeploy exact reviewed source.
To disable, set the enable flag false or revoke the token. The server hard
codes the destination repository; the browser cannot choose another.

A private record reserves each submission with a two-minute publication
lease before posting. The server stores the GitHub issue number and URL.
Exact retries return the same URL, and uncertain results reconcile by checking
recent GitHub Issues for an anonymous per-report marker before creating again.
GitHub has no true idempotent issue-creation endpoint: extremely rare races
or delayed issue visibility may still cause duplicates. Failed requests retain
the form text and never report success without verified GitHub URL.

The private table remains server-only, row secured with no direct client grants.
Its 30-day expiry and account-erasure rules do not extend to external GitHub
copies. A public issue is not user-owned in the Appwrite database.

## Deployment and verification
1. Verify disposable Scratch project explicitly. Run managed additive migration
   019-public-bug-report-issues after 018; it adds private github_issue_url,
   github_issue_number, github_publish_started_at fields. Revalidate drift.
2. Reconcile the current active shared Function source (preserve photos,
   diary, notifications, task behavior), build and deploy exact source
   INACTIVE, then activate after exact-SHA canonical and fresh checks. Never
   replace unrelated newer Scratch behavior or touch Production.
3. Configure restricted token privately; until enabled, publication returns
   503 and does not create a public Issue.
4. Test no-consent/disabled fail closed, consenting dummy issue creation,
   URL receipt and link, duplicate retry, private row permissions and URL,
   rate limit, legacy private action, mobile/PWA/keyboard/theme, and existing
   diary/photo/task operations. Close the synthetic public issue afterwards.
   Never put private user data in a test issue.
5. Promotions to dev, main or Production require separate explicit approval.

Operator private inbox remains via `node scripts/bug-report-inbox.mjs` with a confirmed
Appwrite project ID and appropriately scoped operator credentials.

## Feedback email delivery — issue #1652

The authenticated `submit_feedback` action stores private feedback with a server-derived
`report_kind=feedback`, distinguishing it from bug reports even if a user chooses
a misleading title. Only that type is email-eligible; `publish_bug_report`
continues requiring explicit public GitHub consent.

The `message-action` Function accepts a server-only feedback-row creation event and
tries the Brevo transactional API; its existing hourly schedule retries pending
while marking stale sending leases for review. A saved receipt does **not** confirm delivery.
Sender: `no-reply@mosaic.carlers.is-a.dev`; email contains category, message,
reference and creation time, not diagnostics, user ID or other account data.
The private row expires after 30 days; email copies remain external.

Configuration is default-off until separately set in Oracle Scratch:
`FEEDBACK_EMAIL_ENABLED=true` (nonsecret), `BREVO_FEEDBACK_API_KEY` (secret)
and `FEEDBACK_EMAIL_TO` (secret fixed recipient). Keep these off frontend,
GitHub logs and Production. SMTP recovery credentials are unrelated.
New additive migration `025-feedback-email-delivery` must be applied before
activating the compatible Function. Invalid credentials and explicit HTTP
errors are recorded with bounded retries; network-uncertain outcomes enter
`review` to prevent blind resends. A crash between provider acceptance and
receipt persistence can still require operator reconciliation. `sent`
means Brevo accepted the request, not confirmed inbox delivery.

Acceptance: focused tests, canonical CI, isolated Oracle Scratch migration,
inactive→active Function deployment and private configuration, disposable
feedback submission, row + Brevo receipt + operator inbox check, then
separate explicit owner authorization for Dev/Main/Production promotion.

### Scratch migration 025 index correction

On Oracle Scratch, an earlier run created all nine feedback fields but stopped at
index creation with `Param "columns" is not optional`. The index endpoint takes
`columns` (not `attributes`); migration 025 now uses the API-required property,
validates either supported index readback shape, and is safe to re-run after partial
field creation. Never delete or recreate the private `bug_reports` table to recover.

### Oracle Scratch live Function source parity (v0.85.0)

The first inactive feedback deployment `6aeb46497557f927683b` must **not** be
activated. The currently active `message-action` deployment
`6aeb390c656bd8f509aa` includes private media-reference transaction and
owner-write guards missing from that candidate, plus a live synthetic category
ACL operator exemption and a second media-reference scan just before physical
deletion. The reconciled Preview source preserves these handlers, reconciles
`media_uploads.reference_epoch` additively, and keeps the previous deployment
available for rollback. Neither media deletion nor the experimental media
reference-write fence may be enabled by this feedback rollout.
