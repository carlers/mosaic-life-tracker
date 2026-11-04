# Oracle application-level encrypted disaster recovery — fast track (#975)

**Status (2026-11-04): source-only implementation awaiting focused CI, verified
Oracle Function credentials and an independent synthetic restore.** This does
not change Oracle Production or host containers. It does not establish a
production backup or pass a recovery drill.

## Scope: reuse the verified Cloud architecture

Reuse `appwrite-functions/dr-backup/` and the existing `mosaic-dr/v1`
encrypted *format*: Auth users (excluding sessions), TablesDB schemas,
indexes, row data and permissions; Storage bucket configuration, IDs,
permissions and original file bytes; immutable privacy-deletion markers;
R2 authenticated ciphertext/COMPLETED protocol and retention. Existing
`scripts/dr-restore.mjs`, `scripts/dr-deploy-functions.mjs`,
`scripts/dr-health.mjs` and `scripts/dr-watch.mjs` remain the restore,
integrity and monitoring paths.

This is **logical application-data recovery**. It does not guarantee a
transactionally frozen multi-service checkpoint, redis queue recovery,
ClickHouse analytics, Docker image reconstruction, host secret escrow, OS
configuration restoration or automatic preservation of in-flight writes.
Retain earlier physical Oracle DR notes as optional additional hardening,
not as a blocking prerequisite for an initial application-data backup.

## Verified state and source isolation

- Oracle Scratch project: `6ae94a2100014d01f5ed`. The restricted
  Scratch-migration read-only connector reported two function IDs,
  including `dr_backup`, and the native migration marked completed.
  This does NOT prove a ready deployment, compatible Node runtime,
  Function variables, secret custody, or backup execution.
- Oracle Production project: `6ae9599c002ab812f9c3`; source Function
  configuration is **not independently read**. Production mutations
  require separate authorization.
- Oracle project IDs and app-specific R2 prefixes are declared in the non-executable
  `infrastructure/oracle-app-dr-profiles.mjs`; the Production ID must match
  `appwrite.config.json`. Executable admin scripts require explicit profiles
  and never embed an implicit Production project ID.
- API: `https://129-221-244-67.sslip.io/v1`. This is the reviewed
  Oracle Appwrite endpoint from the repository, not a new backup endpoint.
- The available Oracle Appwrite connector key lacks `functions.read`,
  `users.read` and `buckets.read`. Do not grant it write scopes or
  copy a different project's secret to work around that restriction.
- Historical Appwrite Cloud snapshots retain prefix `mosaic-dr/v1`.
  **Required Oracle R2 prefixes** (same encrypted object format, separate
  object keys): Scratch `mosaic-oracle-scratch-dr/v1`; Production
  `mosaic-oracle-dr/v1`. The Function now rejects mismatched Oracle
  prefixes before any R2 network writes. Cloud source projects remain
  compatible with the original prefix.
- R2 provider-side lock, complete encryption-key escrow and readback of
  any Oracle logical snapshot are NOT VERIFIED. Protect the entire
  Oracle prefix, including blobs and privacy-deletion markers, not just
  its snapshots subtree. Use distinct read-only watcher credentials.

## Fastest safe run order (no production mutation implied)

1. **Read-only Function check.** With a short-lived *project-scoped,
   read-only* key that has `functions.read` (never pasted into chat),
   run from the repository's `life-tracker/` directory:
   `npm run dr:oracle:preflight -- --profile scratch`.
   The preflight uses an exact target ID/endpoint, checks the installed
   `dr_backup` Function's disabled client execution ACL, Node-22
   runtime, 900-second timeout, strictly read-only scopes, exact R2
   prefix, variable names/secret status, manual-execution switch and
   `message-action` deletion marker integration. It prints only fixed
   statuses and exits **2 intentionally**, even if configuration is
   correct. Do not share keys, variable values, or raw HTTP errors.
2. **Reconcile Scratch only.** The imported `dr_backup` Function already
   exists per migration count/ID proof, so do NOT create a duplicate.
   Reuse the repository's source-pinned
   `appwrite:function:configure`, `appwrite:function:deploy` and
   `appwrite:function:activate` CLI flow with the exact Scratch project,
   explicit `--confirm-project`, and approved Scratch-specific
   `functions.read/functions.write` credentials. Preserve schedule
   **blank**. Verify any required `dr_backup` variables using its
   verified runtime config, not a production or Cloud key. No default
   `mosaic-dr/v1` prefix on Oracle.
3. **Synthetic snapshot and integrity.** After verifying the Scratch
   accounts contain synthetic/disposable information, run one
   explicitly controlled, authenticated manual backup while the
   daily schedule is disabled. A temporary
   `DR_ALLOW_MANUAL_EXECUTION=true` may be used only for the specific
   operator-authenticated execution; restore it to `false` immediately.
   Confirm a valid COMPLETED commit, all referenced encrypted bytes,
   user/table/file counts, authenticated decryption and independent
   R2 readback. Never log credentials, row contents or user PII.
4. **Independently restore.** `npm run dr:restore` requires a **fresh,
   empty and isolated** Appwrite target distinct from the source project
   and source Oracle host for the full independent milestone. The live
   shared Oracle Scratch project and existing Cloud Production are
   **not** disposable restore targets. With an approved isolated target
   and separate ephemeral API key, verify users, password-hash support,
   login, IDs, schema, rows, ACLs, photos, privacy deletions and Function
   behavior using synthetic data. Without such a target, report
   `INDEPENDENT_RESTORE=NOT_VERIFIED`; never turn on a schedule.
5. **Owner-approved Production rollout only.** Request separate approval
   to provision/update Oracle Production backup configuration and perform
   an initial encrypted logical snapshot. Verify output and private
   restoration to an approved independent target before calling the
   milestone accepted. Avoid overwriting any earlier Cloud or Oracle
   age-encrypted preliminary archives. Do not auto-copy live data to a
   shared Scratch project.
6. **Automate after real acceptance.** Enable `dr_backup`'s reviewed
   11:00 UTC schedule; enable `DR_ORACLE_WATCH_ENABLED=true` only
   after the first verified Oracle Production snapshot and approved
   restore. The separate GitHub Action reads only the dedicated
   `mosaic-oracle-dr/v1` prefix using independent Object-Read credentials,
   with a 36-hour stale threshold. Configure the
   `DR_ORACLE_R2_ACCOUNT_ID`, `DR_ORACLE_R2_BUCKET`,
   `DR_ORACLE_R2_RECOVERY_ACCESS_KEY_ID` and
   `DR_ORACLE_R2_RECOVERY_SECRET_ACCESS_KEY` secrets. Existing
   `DR_BACKUP_WATCH_ENABLED` and Cloud watcher credentials are
   **not changed**. External failed-run alert delivery must be tested;
   GitHub Action failure alone is not proof that an operator is notified.

## Acceptance

**Application-DR = READY** only after a real Oracle-source COMMITTED
encrypted snapshot, independent full restoration/verification of its
application data into a clean isolated target, verified escrow and R2 lock,
and enabled and observed automated backup/freshness notification.
GitHub CI, migrated Function IDs, a successful preliminary Oracle
age-encrypted archive, or an R2 COMMITTED marker alone are insufficient.
Actual TEST/Production runtime actions have separate authorization gates.

No further owner Docker-container classification or physical-volume
manual review is required for this *application-level* milestone.
