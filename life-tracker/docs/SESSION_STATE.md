# Session checkpoint

Updated: 2026-09-27

Current task: implement Mosaic disaster recovery on `chatgpt/disaster-backups`, targeting
stable Preview `security/disaster-backups`.

Status: implementation is complete as far as repository/Appwrite work can proceed without
Cloudflare recovery credentials. The dedicated `dr_backup` Function is deployed live but
schedule-disabled; no R2/encryption secrets have been added and no production backup schedule
has been enabled.

## Completed in this task
- Added the `mosaic-dr/v1` encrypted snapshot format with AES-256-GCM, per-object nonces/AAD,
  SHA-256 integrity metadata, content-addressed Storage blobs, encrypted manifests, and a
  final `COMPLETED` commit marker.
- Added dynamic Appwrite discovery for users, databases, tables, columns, indexes, rows,
  buckets, files, permissions, and file bytes; schema endpoints without row-style IDs use
  offset pagination.
- Added 7 daily + 4 weekly + 6 monthly retention selection while retaining the configured
  recent lock window and never pruning after an incomplete backup.
- Added the explicit administrator restore/verification CLI and fail-closed handling for
  unsupported auth recovery state.
- Added `npm run dr:check` stale/tamper detection for the newest completed snapshot.
- Made browser Appwrite project/database/bucket/table/function IDs environment-configurable
  so a temporary Mosaic build can target an isolated restored project.
- Added checked-in non-secret Function configs for both Appwrite Function slots.
- Deployed live `dr_backup` with zero client execute roles and only
  users/databases/tables/columns/indexes/rows/buckets/files read scopes.
- Live HTTP smoke test returned 403 while `DR_ALLOW_MANUAL_EXECUTION=false`, confirming
  the deployed manual-execution boundary.
- Production `dr_backup` schedule remains blank.

## Verification
- Structural-red run 1117 failed only because the specified DR modules did not exist yet.
- Focused run 1125 passed after the core implementation/config refactor.
- Focused run 1131 passed after R2 signing/schema-pagination hardening and DR health checks.
- Exact task SHA `67d85a233ac70cb628c654709f5a4fcb67b95efd` passed full Quality Gate run 1132,
  including canonical acceptance.
- That exact accepted source is active in Appwrite as `dr_backup` deployment
  `6ab8f15b57dcf17dac72`; execute roles remain empty, scopes remain read-only, and the
  production schedule remains blank.
- PR #98 was squash-delivered to stable Preview `security/disaster-backups` as
  `40ba7d8286b25c4bd2c59c7aed4dad112a1f7f38`; Vercel built that commit READY.
- Stable Quality Gate run 1133 exposed a nondeterministic browser-contract timing defect:
  the chat dock was sampled immediately after a Playwright viewport resize and occasionally
  retained the prior 915px geometry. This repair waits for the dock to settle at 500px.
- No restore drill, R2 upload, bucket-lock verification, or manual restored-app acceptance is
  claimed yet.

## External acceptance still required
1. Create/select a private Cloudflare R2 bucket and bucket-scoped S3 read/write credentials.
2. Configure a provider bucket-lock rule for the recent recovery prefix/window.
3. Create a 32-byte backup encryption key and escrow that key plus R2 recovery credentials
   outside Appwrite.
4. Add the R2/encryption secrets to `dr_backup`, temporarily permit a controlled manual
   execution, and obtain a valid `COMPLETED` restore point.
5. Restore that snapshot into a fresh isolated Appwrite DR-test project; do not reuse the
   unrelated existing empty project without explicit scope.
6. Deploy the two repository-owned Functions to the DR project, point a temporary Mosaic
   build at it, and complete login/tasks/diary/settings/social/messages/photos acceptance.
7. Only after the drill passes, enable a non-overlapping daily `dr_backup` schedule and
   configure an external runner/alert path for `npm run dr:check`.

## Constraints
- Preserve the two-Function Free-plan architecture.
- Do not add Appwrite write scopes to `dr_backup`.
- Do not log user content, password hashes, decrypted payloads, or file bytes.
- Do not enable the production backup schedule before the isolated restore drill passes.
- Do not promote `security/disaster-backups` to `dev` without explicit user instruction.

Next action: finish the full gate and stable delivery for the browser-contract timing repair.
After that, stop at the external R2/escrow/isolated-restore-drill blocker until recovery
credentials and an independently escrowed encryption key are available.

Blocker: Cloudflare R2 bucket/credentials and independently escrowed encryption material are
not available through the connected tools. A Cloudflare plugin search returned no Cloudflare
integration, so the R2/restore drill cannot be completed from this environment without those
external recovery inputs.
