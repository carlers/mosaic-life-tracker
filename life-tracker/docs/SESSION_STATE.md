# Session checkpoint

Updated: 2026-09-27

Current task: complete the first production disaster backup on
`security/disaster-backups`.

Status: Cloudflare R2 signing is fixed. Two controlled retries now reproducibly fail during
`tables_write_schema`, so the failure is deterministic and later than all Appwrite table
reads. A split-stage diagnostic is implemented to identify schema serialization/encryption
versus R2 PUT/HEAD/verification without logging table names or user data.

## Current live DR state
- `dr_backup` execute roles are empty; Appwrite scopes remain read-only.
- Schedule remains blank.
- `DR_ALLOW_MANUAL_EXECUTION=false` is active on ready deployment
  `6ab946444eb355269711`.
- Required R2/encryption variables remain configured; sensitive values remain secret.
- Refreshed source baseline: 2 users, 1 database, 10 tables, 559 rows,
  1 Storage bucket, 6 files, 615334 file bytes.
- No valid `COMPLETED` restore point is claimed yet.

## Progress
- Stable SigV4 repair passed Quality Gate 1188 and moved backup execution beyond
  `auth_export`.
- Narrow table-export diagnostics passed stable Quality Gate 1195.
- Controlled executions `6ab945c809fa6dfad6e5` and `6ab9463926785b6a8870`
  both failed at `stage=tables_write_schema code=unknown`.
- Direct live checks show database/table/schema/row listing works, including all 474 message
  rows across cursor pages.
- Schema writes now use an opaque 12-character SHA-256 token of the table ID and split
  failures into `_encrypt`, `_put`, `_head`, and `_verify` stages.
- Regression tests cover PUT, HEAD, and verification stage preservation without exposing
  provider detail.
- Focused Quality Gate run 1203 passed.

## Constraints
- Never expose R2 credentials, encryption material, user content, password hashes, raw
  provider error bodies, or table names in diagnostics.
- Keep `DR_ALLOW_MANUAL_EXECUTION=false` outside a controlled execution window.
- Do not enable the production schedule until an isolated restore drill passes.
- Do not promote `security/disaster-backups` to `dev` without explicit user instruction.

Next action: obtain exact-SHA canonical acceptance, squash-deliver to
`security/disaster-backups`, deploy the accepted stable source, run one controlled backup,
and resolve the exact schema-write substage returned.
