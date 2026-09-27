# Session checkpoint

Updated: 2026-09-27

Current task: complete the first production disaster backup on
`security/disaster-backups`.

Status: the first two controlled backup attempts reproducibly reached Cloudflare R2 and
failed on the first object PUT with HTTP 403. The live Function is locked down between
attempts. The current task refines diagnostics so the next attempt can distinguish
Cloudflare permission denial from SigV4/signature or entitlement/endpoint failures without
ever logging the raw provider response.

## Current live DR state
- `dr_backup` has zero execute roles and only read-only Appwrite scopes.
- Schedule remains blank.
- `DR_ALLOW_MANUAL_EXECUTION=false` outside controlled attempts.
- Required R2/encryption variables remain configured; sensitive values remain secret.
- Live source baseline: 2 users, 1 database, 10 tables, 559 rows, 1 Storage bucket,
  6 files, 615334 file bytes.
- No valid `COMPLETED` restore point is claimed yet.

## Reproducible failure
- Controlled executions reached `stage=auth_export code=r2_http_403`.
- That means Appwrite user export and encryption/config parsing succeeded, then the first
  encrypted R2 PUT was rejected.
- User confirmed the current writer credential is Object Read & Write, bucket-scoped to the
  configured backup bucket, and the Appwrite variables contain the R2 Access Key ID and
  Secret Access Key.
- A transient retry produced the same 403, so the next distinction must come from the S3
  error code rather than credential replacement by assumption.

## Diagnostic refinement
- R2 transport now parses only the S3 `<Code>` element from failed XML responses and
  discards the provider message/body.
- Handler maps allowlisted S3 codes such as `AccessDenied`,
  `SignatureDoesNotMatch`, `ExpiredRequest`, and `NotEntitled` to secret-safe
  operational codes.
- Regression tests prove fake secret text in provider error messages never reaches thrown
  errors, Function logs, or responses.
- Focused Quality Gate run 1180 passed the initial parser/classifier change.
- Full run 1181 correctly failed because the old raw provider-body throw path was still active; this was a real implementation defect, not test flakiness.
- Commit `b2a0ea75e31a40b3cf84b4bf22710eab6dade2c1` replaces that throw path so only the sanitized S3 code survives; focused Quality Gate run 1182 passed.

## Constraints
- Never expose R2 credentials, encryption material, user content, password hashes, or raw
  provider error bodies.
- Keep `DR_ALLOW_MANUAL_EXECUTION=false` outside a controlled execution window.
- Do not enable the production schedule until an isolated restore drill passes.
- Do not promote `security/disaster-backups` to `dev` without explicit user instruction.

Next action: obtain canonical acceptance for the corrected refined diagnostics, squash to
`security/disaster-backups`, deploy the accepted stable source, rerun one controlled backup,
and act on the returned S3-specific safe code.
