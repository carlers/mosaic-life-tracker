# Pre-1.0 Production-target acceptance — local release candidate (#889)

This is the **owner-operated release acceptance** for Mosaic v0.29.1 before protected
`dev → main` promotion. It does **not** approve the release or replace
[Delivery](DELIVERY.md). An official Vercel Preview (including `dev`) must
always use Scratch Appwrite; never retarget it to Production for convenience.
Do not reopen the retired v0.17.4 Production PWA after schema migration 012/013/015.

## Established, independently checked release context (2026-10-16 UTC)

- Approved owner-only historical installed PWAs have been synced and retired;
  authenticated encrypted R2 `dr:check` returned
  `ok: true` for backup `20261016T110126909Z` (completed
  2026-10-16 11:02:17 UTC); R2/decryption recovery escrow was owner-confirmed.
  This is an owner attestation, not telemetry from every old device.
- Production Appwrite `6a9703c50016b37110ff` reconciled Git-defined
  migrations 010–015 individually with readback: 17 tables, Diary 9 columns,
  Messages 25 columns, Bucket List/links and server-only private reactions.
  The actual writes used the authenticated Appwrite connector rather than the
  preferred local CLI because secret transfer was blocked; no unscoped migration
  and no migration 008 was run.
- `message-action` now uses ready active deployment
  `6ad20d5de9380307809d`, built from exact source
  `c733bfa73f4ca742f6333ee75e11c642f83daf53`.
  Prior `6acb8162dc02a1deaa23` remains READY for rollback. Hourly schedule,
  events, execute grants, scopes and six required non-secret variables match
  Git; `dr_backup` schedule/deployment unchanged. A real authenticated,
  read-only `get_notifications` Function execution returned HTTP 200 after
  activation, but this is not two-account or device acceptance.
- The exact client source `dev@c733bfa73f4ca742f6333ee75e11c642f83daf53`
  passed canonical CI and Vercel Scratch Preview, and a separate **local**
  Production-configured build succeeded with PWA/build/size checks; its HTTPS
  root and `/settings/notifications` returned HTTP 200 and the compiled bundle
  embedded the correct Production project. No credentials were embedded.
- Main still serves v0.17.4; release [PR #909](https://github.com/carlers/mosaic-life-tracker/pull/909)
  is unmerged. Do not release/tag 1.0.0 as part of v0.29.1.

## Open the exact new client against Production without Vercel changes

Production Appwrite already has a **specific registered laptop Web platform**.
Identify its private hostname in the Production Appwrite project's platform
settings, and ensure that IP is currently assigned to the laptop (e.g. its
existing Tailscale IPv4 address). Do not introduce or widen origin permissions.

From the **Git root's `life-tracker/` directory** on the registered laptop:

```bash
git status --short
git fetch origin
git switch dev
git pull --ff-only origin dev
test "$(git rev-parse HEAD)" = "c733bfa73f4ca742f6333ee75e11c642f83daf53"
npm ci --ignore-scripts --no-audit --no-fund
```

If the worktree is dirty, a ref moved, npm fails, or the SHA assertion fails,
stop. Resolve via the issue and refresh this pin rather than testing an
unreviewed client. Use a clean terminal without inherited Scratch
`VITE_APPWRITE_*` table overrides.

```bash
# Substitute the exact existing private hostname, without angle brackets.
export MOSAIC_ACCEPT_HOST="YOUR_ALREADY_REGISTERED_LAPTOP_IP"
ip -o -4 addr show | grep -F "$MOSAIC_ACCEPT_HOST"

export GITHUB_REPOSITORY="carlers/mosaic-life-tracker"
export VITE_APPWRITE_ENDPOINT="https://sgp.cloud.appwrite.io/v1"
export VITE_APPWRITE_PROJECT_ID="6a9703c50016b37110ff"
export VITE_APPWRITE_DATABASE_ID="life_tracker"
export VITE_APPWRITE_STORAGE_BUCKET_ID="task_images"
export VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID="6aa8057f002a4c306fdd"

env -u VERCEL_ENV npm run build
env -u VERCEL_ENV npm run preview -- --host "$MOSAIC_ACCEPT_HOST" --port 4173 --strictPort
```

On the registered laptop, open `https://<registered-laptop-ip>:4173/` in a
fresh browser profile. Vite local builds use a self-signed HTTPS certificate;
approve a certificate exception only on your own trusted development laptop.
Mobile service workers, installation and Web Push may **not** work with an
untrusted certificate. Do not mark those checks passed merely because a page
loads; establish a trusted HTTPS context first or leave device acceptance
blocked. The local server must remain running while testing. **No administrator
API key** is required, and none should be put in a `VITE_*` variable.

Check Settings for the **effective** Appwrite project/endpoint before writing
user data. It must be the Production ID and Singapore endpoint above. If
different, stop: the build is targeting the wrong backend.

## Actual signed-in owner acceptance — report each result

Use **two existing test-controlled accounts in separate browser profiles**,
not two users sharing one local RxDB/session cache. Do not log in through the
still-retired official v0.17.4 Production host. Test ordinary, reversible data
only; do not test permanent account deletion on a real account.

1. **Authentication and sync:** log in on both profiles; compare an existing
   task and Diary entry; Sync Now completes without partial groups/errors.
   Switch accounts without displaying the former account's cached records.
2. **Diary:** create/edit one temporary entry and day emoji; attach/open/remove
   a photo; verify visibility privacy from the second account and friend
   reactions only when authorized.
3. **Chat and social:** send/reply/react between accounts; send a Diary-linked
   message, then sync both accounts; check friendship rules, read receipts,
   private item denial and the absence of accidental cross-account data.
4. **Bucket List/task link:** create a private aspiration and link/unlink a
   task; sync across devices/profiles without exposing another owner's items.
5. **Notifications/push:** trigger a task completion and one social event;
   verify notification detail, visibility, mark-read and per-device push
   consent. Push is **unverified** if the local TLS origin is not trusted.
6. **Offline/reconciliation:** on one client, go offline, edit a temporary
   task/Diary, reconnect and Sync Now; verify both devices converge, including
   no duplicates, deleted content resurrection or cross-account leakage.
7. **Mobile/PWA:** open the same verified-origin candidate on a real phone
   with network access to that private IP, verify touch/Day View, installed-PWA
   upgrade/install and offline reconnect. A desktop simulation is not a
   substitute. Certificate or origin problems count as **blocked**, not PASS.

For each scenario report **pass / fail / blocked**, device/browser, and only
redacted failure diagnostics. Do not paste message content, diary text,
credentials, tokens or backups into GitHub. Stop on real user-data loss,
unauthorized access, repeating sync failures or permission regressions;
preserve local records for investigation.

Close local Preview with Ctrl-C after ensuring the temporary test edits are
fully synced or deliberately reverted via the app. Do not clear its browser
storage while unsynced writes remain.

## Promotion and rollback boundary

Only after signed-in acceptance is recorded and the latest exact `dev`
commit + canonical CI, Appwrite schema/Function and recovery health are still
confirmed should the owner explicitly approve [PR #909](https://github.com/carlers/mosaic-life-tracker/pull/909)
for normal protected `dev → main` merge. Confirm main's **own** full CI,
Production Vercel READY at the exact merged SHA, and GitHub release publisher.
The 1.0.0 milestone is independent. In a Function regression, the previous
READY `message-action` deployment ID above is an available code rollback
target; schema rollback is **not** automatically safe, and the old PWA must not
be used as the fallback after new columns were added.
