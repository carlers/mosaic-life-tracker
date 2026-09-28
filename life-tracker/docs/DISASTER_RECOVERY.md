# Disaster recovery

Mosaic's disaster-recovery (DR) system is an administrator-only recovery path. It is
separate from Settings → Backup & Restore, which remains a user-controlled portable-data
feature.

## Recovery objective

A completed DR snapshot must be sufficient to rebuild a fresh Appwrite project from Git
plus the encrypted snapshot and the escrowed recovery secrets. The snapshot covers:

- Auth users, including stable user IDs, account metadata, preferences, verification
  state, and password hash/hash metadata where Appwrite exposes it. Sessions are excluded.
- Every TablesDB database and table discovered at backup time, including table
  permissions, row-security/enabled state, columns, indexes, row IDs, row data, and row
  permissions. The exporter must not hardcode the current table list.
- Every Storage bucket discovered at backup time, including bucket configuration, file
  metadata/permissions, original file IDs/folders, and raw file bytes.
- Application/function source and non-secret infrastructure configuration from Git. Secrets
  are never stored in the repository or snapshot manifest in plaintext.

## Function boundary

The Free-plan two-Function architecture is deliberate:

1. The existing `message-action` slot is the general trusted application backend and may
   later be renamed/refactored to `app-api`. Messaging/social operations, tombstone GC,
   external-provider routes/webhooks, and coordinated integration maintenance share this
   slot through isolated modules.
2. `dr-backup` owns the second slot. It has no client execute roles and only source-read
   Appwrite scopes: users, databases, tables, columns, indexes, rows, buckets, and files.
   It must not receive Appwrite write scopes.

The DR Function accepts scheduled executions. Manual server execution is permitted only
when `DR_ALLOW_MANUAL_EXECUTION=true` and Appwrite supplies the execution API key header.
A normal browser/user execution is rejected even if it reaches the handler.

## Snapshot format

The current format is `mosaic-dr/v1`.

Each run receives a timestamp-derived backup ID and writes beneath
`<prefix>/snapshots/<backupId>/`. Snapshot objects are compressed where useful and
encrypted independently with AES-256-GCM. The master key is a 32-byte random value supplied
as base64 in `DR_ENCRYPTION_KEY_B64`; every encrypted envelope records its
`DR_KEY_VERSION`. A unique random 96-bit nonce is generated per object. The R2 object key
is authenticated as AES-GCM additional authenticated data so encrypted objects cannot be
silently moved/substituted.

Snapshot metadata contains SHA-256 hashes for plaintext and encrypted bytes. Storage file
bytes are content-addressed by plaintext SHA-256 and stored once beneath
`<prefix>/blobs/<keyVersion>/<sha256>.enc`; snapshots reference those blobs rather than
copying unchanged images/files every day.

The writer uses a commit protocol:

1. upload encrypted snapshot resources and any missing encrypted blobs;
2. HEAD/re-read metadata needed to verify uploaded ciphertext size/hash;
3. upload and verify the encrypted manifest;
4. write a small plaintext `COMPLETED` marker containing only operational identifiers and
   the manifest ciphertext hash.

A prefix without a valid `COMPLETED` marker is never a restore point and is never used as
evidence that backup succeeded. User content, password hashes, decrypted payloads, emails,
names, message text, diary text, and file bytes must never be logged.

## Retention

The minimum retained tiers are 7 daily, 4 weekly, and 6 monthly completed restore points.
Snapshots inside `DR_OBJECT_LOCK_DAYS` (default 30) are retained regardless of tier so the
pruner does not intentionally fight the R2 lock window. A failed or incomplete backup never
causes pruning. Snapshot pruning never deletes content-addressed blobs automatically; blob
garbage collection requires a separate reference-safe process.

R2 bucket lock for the recent recovery window is configured at the provider. Lock the full `mosaic-dr/v1/` prefix, not only `snapshots/`, so content-addressed file blobs cannot be deleted while a locked snapshot still references them. The Function does not attempt to weaken or bypass provider retention.

## Secrets and escrow

Required runtime secrets are:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `DR_ENCRYPTION_KEY_B64`

`DR_KEY_VERSION`, `DR_PREFIX`, retention values, and optional `R2_ENDPOINT` are non-secret configuration. Leave `R2_ENDPOINT` unset for normal/location-hint buckets. For a Cloudflare jurisdiction bucket, set the matching account endpoint (for example `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`). Mosaic rejects endpoint hosts outside Cloudflare R2 for that account.

The encryption key and R2 recovery credentials must have an independent copy outside the
Appwrite project (password manager/offline recovery record). An Appwrite-only copy is not a
recovery mechanism for an Appwrite-loss event.

## Restore

`npm run dr:restore -- --snapshot <backupId> --target-project <projectId>` is an explicit
administrator command. It requires a target-project API key through the environment and
never uses the source Function's credentials.

Restore order is:

1. decrypt and verify the committed manifest and every referenced object;
2. recreate Auth users with original IDs and imported password hashes where supported,
   then restore non-session account metadata;
3. recreate databases/tables with original IDs, permissions, columns, and indexes;
4. recreate rows with original IDs and permissions;
5. recreate Storage buckets/files with original IDs, permissions, folders, and verified
   file bytes;
6. verify target resource IDs, schemas, row records/checksums, user records/hash metadata,
   file SHA-256 values, and permissions;
7. deploy/configure the repository-owned application Functions against the target project.

The restore command refuses to target the same project ID recorded in the snapshot and
refuses a non-empty target. It fails closed for unsupported password-hash types or MFA-enabled
accounts rather than silently resetting credentials. Sessions are intentionally not restored.
Production restore is never automatic.

Repository-owned Function configuration is recorded in
`appwrite-functions/*/function.config.json`. The data restore/verification CLI performs the
Auth/TablesDB/Storage recovery; after it verifies those resources, run
`npm run dr:deploy-functions -- --target-project <projectId>` with a short-lived target
API key that has `functions.read` and `functions.write`.
The recovery deploy command packages the checked-in Function source, recreates both
Functions, and forcibly keeps both schedules blank for the isolated drill. It deliberately
does **not** copy the escrowed R2 recovery credential or DR encryption key into the restored
project; `dr-backup` remains inert until fresh runtime backup credentials are intentionally
provisioned. The DR Function remains schedule-disabled until the entire isolated drill passes.

## Operations

- `npm run dr:restore -- --snapshot <backupId> --target-project <projectId>` restores and
  verifies a committed snapshot in a fresh target project.
- `npm run dr:restore -- --snapshot <backupId> --target-project <projectId> --verify-only`
  re-runs verification against an already restored target.
- `npm run dr:deploy-functions -- --target-project <projectId>` deploys the two
  repository-owned Functions into an already restored project. It requires
  only `APPWRITE_TARGET_API_KEY` and `APPWRITE_TARGET_ENDPOINT`; it refuses targets
  that already contain Functions and verifies both deployed schedules remain blank. The
  isolated drill does not import escrowed recovery secrets into Appwrite.
- `npm run dr:check` performs the authenticated operator check: it decrypts/verifies the newest committed manifest and exits non-zero when it is missing, tampered, or older than `DR_MAX_AGE_HOURS` (default 36).\n- `npm run dr:watch` is the external metadata-only stale-backup check. It needs only bucket-scoped R2 Object Read credentials, validates the newest `COMPLETED` marker plus manifest object/hash metadata, and never needs `DR_ENCRYPTION_KEY_B64`. It does not replace the authenticated `dr:check`.\n- `.github/workflows/dr-backup-watch.yml` runs `dr:watch` daily at 00:15 UTC when repository variable `DR_BACKUP_WATCH_ENABLED=true`. Keep it disabled until the first restore drill passes and a completed production backup exists. Configure GitHub Actions secrets `DR_R2_ACCOUNT_ID`, `DR_R2_RECOVERY_ACCESS_KEY_ID`, `DR_R2_RECOVERY_SECRET_ACCESS_KEY`, and `DR_R2_BUCKET` using a separate bucket-scoped **Object Read only** R2 token. A failed workflow is the external stale-backup signal.
- `appwrite-functions/dr-backup/function.config.json` is the non-secret source of truth for
  the dedicated backup Function boundary. After the accepted restore drill, the production
  schedule is `0 11 * * *` (11:00 UTC daily). The external watcher runs at 00:15 UTC;
  this spacing means that if one daily backup is missed, even a prior run that consumed
  the full 15-minute Function timeout is older than the 36-hour stale threshold by the
  next watcher check.
- `appwrite-functions/message-action/function.config.json` records the existing general
  trusted Function configuration needed during recovery.
- When changing a live Appwrite Function through the API, send the complete intended
  Function configuration rather than only the changed field. The Appwrite update endpoint
  can apply defaults to omitted optional fields. During the first production schedule
  rollout, a schedule-only update temporarily reset scopes/timeout/build settings; the
  rollout detected and reverted that state immediately. Re-read the complete Function
  after every configuration write before considering the change accepted.

## Acceptance and rollout

The production schedule remains blank until all of the following are true:

1. focused/unit/handler verification and canonical acceptance pass;
2. the `dr-backup` Function is deployed with zero client execute roles and read-only
   Appwrite scopes;
3. an R2 bucket/token and independently escrowed encryption key are configured;
4. a manual backup reaches a valid `COMPLETED` marker;
5. that snapshot is restored into a separate Appwrite DR-test project;
6. automated verification reports matching schemas, row IDs/data/permissions, user IDs and
   recoverable auth metadata, and file hashes/permissions;
7. a temporary Mosaic build using the DR project passes manual login, tasks, diary/settings,
   friendships/messages, and photo checks.

Only after the drill passes may a non-overlapping daily production schedule be enabled.
The accepted production schedule is 11:00 UTC daily (`0 11 * * *`).
A stale-backup check treats the newest valid `COMPLETED` snapshot older than 36 hours as
unhealthy. A check that cannot reach R2 is also unhealthy; absence of an alerting transport
must not be described as active monitoring.
