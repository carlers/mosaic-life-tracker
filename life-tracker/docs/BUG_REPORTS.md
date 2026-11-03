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

Operator private inbox remains via npm run bug-reports:inbox with a confirmed
Appwrite project ID and appropriately scoped operator credentials.

## Private general feedback — issue #1652

Settings → Send feedback (also About Mosaic → Send feedback) is a separate
user-facing form for suggestions, experience feedback and other comments.
It intentionally reuses the already deployed authenticated
`submit_bug_report` private action and the server-only `bug_reports` table.
Feedback is distinguished in the operator inbox by a fixed
`[Feedback] Suggestion`, `[Feedback] Experience` or
`[Feedback] Other feedback` title. It never calls
`publish_bug_report` and never creates a public GitHub Issue.
This scoped reuse adds no schema, Function, token, or mail destination.

Only the chosen type, text, random idempotency request ID and, when explicitly
enabled, the previewed bounded diagnostics are submitted. Account identity
is derived from the authenticated session on the server, not from client text.
No task, Diary, chat, image, screenshot, email or page contents are included
automatically. Storage is operator-readable and is **not end-to-end encrypted**.
The existing server retains entries for up to 30 days and deletes them on
account erasure. The five-per-hour per-account limit is shared with private
and public bug reporting. The operator views entries with the existing
`npm run bug-reports:inbox` command against an explicitly confirmed target.

Offline or unconfirmed submissions do not show success; the unsent draft and
unchanged request ID stay in the current Settings session so retry remains
idempotent. Switching accounts discards the draft and receipt. A confirmed
server receipt is displayed after successful private submission. A signed-in
user must be online to submit. The Help Center is independent future scope
under #1652; this iteration does not implement one. The operator inbox has
no reply pipeline; the UI does not solicit a contact email or promise replies.

Check the active target's private intake and retention configuration before
claiming end-to-end acceptance. No Production rollout is implicit in a Preview.
