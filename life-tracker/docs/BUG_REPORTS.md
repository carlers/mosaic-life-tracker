# Private user bug reports — issue #854

## Scope and privacy
The first milestone is text-only, authenticated and online-only. Settings → About Mosaic opens a shared BottomSheet form. Users can report a short title, description and optional reproduction steps. They can **opt in** to previewed, allowlisted browser/OS/build metadata; no full user-agent, URL, query string, task, diary, message, email, account ID, stack trace, session replay, or file is automatically submitted.

Reports are stored in the server-owned `bug_reports` table with **no client table permissions**, using the existing authenticated `message-action` Function. Function caller identity, not browser-supplied IDs, owns a report. Row IDs are SHA-256 derived from authenticated caller and client-generated request nonce; the same submission yields the same reference even after a network timeout. A different body with the same nonce conflicts. The backend limits five reports per hour per account (distinct concurrent requests may race the sliding-window check).

The first version does **not** provide a user-facing report history, automated GitHub publishing, developer response, or delivery guarantee. Auth/offline failures preserve the current open form draft and provide an optional copyable/public GitHub fallback; users must consent to publication separately.

## Storage, retention and erasure
Reports expire after **30 days**, with bounded hourly server cleanup. Only a separately redacted, explicitly reviewed public GitHub issue may be retained afterward. Reports are server-only records, not RxDB-synced data. The new table is included in Git-managed schema and backup/restore discovery, account-erasure policy, and the account deletion worker's owned-table scan. Account erasure follows the existing DR privacy marker first; never bypass that boundary. The original reporter ID is never returned by the public submission API.

Do not reuse `task_images` to attach screenshots. A future image phase requires separate review of private storage, retention, metadata removal and DR erasure. Keep PostHog's minimal exception adapter independent and replay/autocapture disabled.

## Deployment
1. On the **explicitly confirmed disposable Scratch project**, reconcile migration `018-bug-reports` through `appwrite:preview:prepare --apply` (or the explicitly selected managed migration); verify table permissions, columns, indexes and status. No permission drift is implicitly repaired.
2. Deploy the reviewed exact-SHA `message-action` Function **inactive**, then explicitly activate in Scratch and verify an authenticated synthetic report, duplicate retry, cross-account rejection, rate limiting and private operator retrieval.
3. Check the exact-SHA Preview canonical suite, size budgets and Vercel READY, then manual PWA/theme/keyboard acceptance. No Production migration, Function activation or `dev`/`main` promotion without separate approval.
4. Read reports only from an operator terminal with appropriately scoped project credentials: `APPWRITE_ENDPOINT=... APPWRITE_PROJECT_ID=... APPWRITE_API_KEY=... npm run bug-reports:inbox -- --project PROJECT_ID --confirm-project PROJECT_ID [--report-id bug_...]`. This deliberately has no browser admin UI. Console output is sensitive; never paste raw reports into public GitHub Issues or CI logs.
