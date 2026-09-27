# Session checkpoint

Updated: 2026-09-27

Current task: complete the first production disaster backup on
`security/disaster-backups`.

Status: Cloudflare R2 signing is fixed and the controlled backup now gets past auth export.
The latest attempt failed later during the broad `tables_export` stage with no safe code.
A narrow diagnostic patch is implemented and focused verification is green so the next live
attempt can identify the exact table export operation without exposing provider data.

## Current live DR state
- `dr_backup` execute roles are empty and Appwrite scopes remain read-only.
- Schedule remains blank.
- `DR_ALLOW_MANUAL_EXECUTION=false` is active on ready deployment
  `6ab93bee43e2e2a62300`.
- Required R2/encryption variables remain configured; sensitive values remain secret.
- Live source baseline remains 2 users, 1 database, 10 tables, 559 rows,
  1 Storage bucket, 6 files, 615334 file bytes.
- No valid `COMPLETED` restore point is claimed yet.

## Progress
- R2 S3 diagnostics isolated the initial 403 as `SignatureDoesNotMatch`.
- Stable SigV4 fix corrected the missing canonical-request separator and passed full stable
  Quality Gate 1188.
- Controlled execution `6ab93be235d3351bc9d9` then passed auth export and failed at
  `stage=tables_export code=unknown`, proving Cloudflare credentials/signing are no longer
  the blocker.
- Direct live checks confirmed database/table/row listing works, including all five pages
  of the 474-row messages table.
- Added narrow failure stages for database/table/column/index/row reads, table schema/row
  writes, Storage reads/writes, commit marker/manifest work, and retention.
- Added safe `appwrite_http_<status>` classification without logging Appwrite error text.
- Tests cover stage preservation and guarantee provider diagnostic text is not returned.
- Focused Quality Gate run 1193 passed.

## Constraints
- Never expose R2 credentials, encryption material, user content, password hashes, or raw
  provider error bodies.
- Keep `DR_ALLOW_MANUAL_EXECUTION=false` outside a controlled execution window.
- Do not enable the production schedule until an isolated restore drill passes.
- Do not promote `security/disaster-backups` to `dev` without explicit user instruction.

Next action: obtain exact-SHA canonical acceptance, squash-deliver to
`security/disaster-backups`, deploy the accepted stable source, run one controlled backup,
and use the narrow stage/code to resolve the remaining table-export failure.
