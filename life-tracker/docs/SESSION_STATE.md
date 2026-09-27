# Session checkpoint

Updated: 2026-09-27

Current task: complete the first production disaster backup on
`security/disaster-backups`.

Status: the remaining deterministic table-schema failure has been identified as JSON
serialization of Appwrite 64-bit integer bounds. The DR snapshot/restore codec now uses
BigInt-aware JSON so exact int64 values are preserved instead of rounded or dropped.

## Current live DR state
- `dr_backup` execute roles are empty; Appwrite scopes remain read-only.
- Schedule remains blank.
- `DR_ALLOW_MANUAL_EXECUTION=false` is active on ready deployment
  `6ab947f76f676dc59a71`.
- Required R2/encryption variables remain configured; sensitive values remain secret.
- Source baseline: 2 users, 1 database, 10 tables, 559 rows, 1 Storage bucket,
  6 files, 615334 file bytes.
- No valid `COMPLETED` restore point is claimed yet.

## Root cause and repair
- R2 credentials/signing are fixed; auth export succeeds.
- Narrow diagnostics proved Appwrite table reads succeed and repeated failures occur before
  the encrypted schema writer enters its PUT/HEAD/verify substages.
- Live schema inspection found `categories.order` exposes signed 64-bit bounds
  (-9223372036854775808 to 9223372036854775807). The Node Appwrite SDK surfaces unsafe
  int64 values as native BigInt.
- Plain `JSON.stringify` cannot serialize BigInt, which caused the deterministic
  `tables_write_schema` failure.
- DR backup JSON now uses `json-bigint` with native BigInt support; restore parsing and
  deterministic verification use the same codec.
- `json-bigint@1.0.0` is declared explicitly for the Function and root DR tooling; it was
  already present transitively through `node-appwrite`.
- Regression tests pin exact ±2^63 schema-bound round trips and DR JSONL BigInt restore.
- Focused Quality Gate run 1212 passed.

## Constraints
- Never expose R2 credentials, encryption material, user content, password hashes, or raw
  provider error bodies.
- Keep `DR_ALLOW_MANUAL_EXECUTION=false` outside a controlled execution window.
- Do not enable the production schedule until an isolated restore drill passes.
- Do not promote `security/disaster-backups` to `dev` without explicit user instruction.

Next action: obtain exact-SHA canonical acceptance, squash-deliver to
`security/disaster-backups`, deploy the accepted stable source, run one controlled backup,
reconcile counts, and verify a valid `COMPLETED` snapshot.
