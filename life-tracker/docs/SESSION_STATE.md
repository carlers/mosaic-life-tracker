# Session checkpoint

Updated: 2026-09-27

Current task: complete the first production disaster backup on
`security/disaster-backups`.

Status: repository diagnostics are accepted and deployed. The Appwrite Function is currently
locked down. The remaining blocker is the Cloudflare R2 writer credential: the first R2
object write returns HTTP 403.

## Current live DR state
- `dr_backup` active deployment: `6ab92fe0bdba615e15d5`.
- Source corresponds to accepted stable commit
  `4e29195decaa038fbca977dae9ea7da13429e539`.
- Execute roles are empty.
- Appwrite scopes remain read-only:
  users/databases/tables/columns/indexes/rows/buckets/files.
- Schedule remains blank.
- `DR_ALLOW_MANUAL_EXECUTION=false` is active.
- R2 account ID and bucket configuration pass structural validation.
- Required R2/encryption variables are present; sensitive values remain secret.

## Verification and backup attempts
- Safe-diagnostics task SHA `4eae79bf8db2ebaafed51ada4aed3b0ed95e9e74`
  passed full Quality Gate run 1173.
- PR #103 was squash-delivered to stable as
  `4e29195decaa038fbca977dae9ea7da13429e539`.
- Stable Quality Gate run 1174 passed canonical acceptance.
- Locked-state smoke execution `6ab92f7d7f87a01339ff` correctly returned 403 while
  manual execution was disabled.
- Live source baseline before backup: 2 users, 1 database, 10 tables, 559 rows,
  1 Storage bucket, 6 files, 615334 file bytes.
- Controlled backup execution `6ab92fba2ec535d48bce` failed safely with
  `stage=auth_export code=r2_http_403`.
- That stage means Appwrite user reads and encryption/config parsing completed, then
  Cloudflare rejected the first encrypted R2 object PUT.
- No valid `COMPLETED` restore point is claimed yet.

## External blocker
Replace the R2 writer credential with a fresh bucket-scoped **Object Read & Write** S3
credential pair for the configured backup bucket. Appwrite requires the R2 **Access Key ID**
and **Secret Access Key**, not a Cloudflare bearer/API-token value. Do not change the
read-only recovery/watcher credential.

After the writer pair is replaced in the secret Function variables, redeploy the accepted
Function so variables take effect, then repeat one controlled backup. Keep the manual gate
false outside that execution window.

## Constraints
- Never expose R2 credentials, encryption material, user content, password hashes, or raw
  provider error bodies.
- Do not leave `DR_ALLOW_MANUAL_EXECUTION=true` outside a controlled execution window.
- Do not enable the production schedule until an isolated restore drill passes.
- Do not promote `security/disaster-backups` to `dev` without explicit user instruction.

Next action: user creates/replaces the Cloudflare R2 writer S3 credential pair, updates the
two Appwrite secret variables, and replies `updated`. Then rerun the backup immediately.
