# Session checkpoint

Updated: 2026-09-27

Current task: complete the first production disaster backup on
`security/disaster-backups`.

Status: Cloudflare credentials and bucket permissions were not the cause of the repeated
403. Secret-safe diagnostics identified `SignatureDoesNotMatch`, and the hand-written
SigV4 canonical request was missing the required blank line between CanonicalHeaders and
SignedHeaders. The signer is fixed on `chatgpt/dr-r2-signature-fix`; live production
`dr_backup` remains locked down while the fix is verified.

## Current live DR state
- `dr_backup` execute roles are empty and Appwrite scopes remain read-only.
- Schedule remains blank.
- `DR_ALLOW_MANUAL_EXECUTION=false`.
- Required R2/encryption variables remain configured; sensitive values remain secret.
- Live source baseline before the failed attempts: 2 users, 1 database, 10 tables, 559 rows,
  1 Storage bucket, 6 files, 615334 file bytes.
- No valid `COMPLETED` restore point is claimed yet.

## Diagnosis
- Repeated controlled executions initially reported `stage=auth_export code=r2_http_403`.
- Refined diagnostics, accepted on stable commit
  `8389f59f742f1ef0f5c8efe00f2e44a0b70546b4`, then reported
  `stage=auth_export code=r2_signature_mismatch`.
- Cloudflare therefore authenticated the request path far enough to calculate a signature;
  this isolated the defect to Mosaic's SigV4 implementation rather than requiring the user
  to rotate credentials.
- The canonical request concatenated `canonicalHeaders + signedHeaders` into one array
  element. Because CanonicalHeaders itself terminates with a newline, this omitted the
  additional separator required by AWS SigV4 canonical-request format.

## Repair
- The canonical request now treats CanonicalHeaders and SignedHeaders as separate components.
- The R2 unit test now pins the exact deterministic Authorization signature for a known PUT,
  rather than only checking the header shape.
- Focused Quality Gate run 1186 passed.

## Constraints
- Never expose R2 credentials, encryption material, user content, password hashes, or raw
  provider error bodies.
- Keep `DR_ALLOW_MANUAL_EXECUTION=false` outside a controlled execution window.
- Do not enable the production schedule until an isolated restore drill passes.
- Do not promote `security/disaster-backups` to `dev` without explicit user instruction.

Next action: obtain canonical acceptance for the SigV4 repair, squash-deliver it to
`security/disaster-backups`, deploy that exact stable source to live `dr_backup`, run one
controlled backup, reconcile counts against a refreshed live inventory, and immediately
return the Function to manual-disabled state.
