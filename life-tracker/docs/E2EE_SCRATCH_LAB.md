# Mosaic E2EE Scratch Lab — isolated backend provisioning

Owner-created Oracle project ID: `6b00671500279e901846`.
Existing normal shared Preview/Dev project ID: `6ae94a2100014d01f5ed`.
Existing TEST: `6ae1bf2e00034572451b`.
Production: `6ae9599c002ab812f9c3`.
Root tool and private credentials: [ops #295](https://github.com/carlers/mosaic-server-ops/issues/295).
E2EE implementation: [#1662](https://github.com/carlers/mosaic-life-tracker/issues/1662), [#2084](https://github.com/carlers/mosaic-life-tracker/issues/2084).

## Current live isolated Scratch checkpoint (2026-11-21)

- Oracle `Mosaic Oracle Operations` E2EE lab worker independently reports
  `media_ready` for bootstrap SHA
  `5d81197535a80337a7c49c439d9c323cf9098b34`, after the owner-installed
  Node v22.23.5 / npm 10.9.9 runtime passed its hash/host/journal guards.
- Isolated Appwrite project `6b00671500279e901846`: `life_tracker`
  database, **20 tables** (including four crypto tables), **two storage
  buckets** `task_images` and `private_owner_media_v1`; `message_action`
  live deployment `6b0143680d2ab2ec1031` enabled, schedule disabled.
  **Zero users** at the bootstrap readback. This is not any real-data migration.
- Owner-provided `MOSAIC_E2EE_ORIGIN_*` receipts include
  `WEB_PLATFORM_CREATED`, `PLATFORM_READBACK_PASS`,
  `LAB_JOURNAL_AND_KEYS_UNCHANGED`, and
  `PREVIEW_TEST_PRODUCTION_UNCHANGED`. The registered hostname is
  `mosaic-e2ee-scratch-git-chatgpt-214047-carls-projects-72516fde.vercel.app`.
- The E2EE-only Vercel project is
  `prj_O7svU9O5nN9AkKaCdKkwjud3Gk05`. The original exact source
  `5d811975...` Preview deployed READY; later client/Function source
  corrections through #2206 are scoped to the same dedicated branch and must
  pass their own exact-SHA canonical CI and READY build.
- **Important implementation blocker:** The original live Function deployment
  predates the #2206 correction of old normal-Preview project IDs in
  `e2ee-pilot.js`, `e2ee-owner.js`, the isolated pilot page, and its transport.
  Its `MOSAIC_E2EE_PILOT_ENABLED` and `MOSAIC_E2EE_OWNER_ENABLED`
  variables remain default-OFF, with empty owner allowlists. Deploying a
  corrected client does **not** update the Function or activate synthetic writes.
  The installed `mosaic_oracle_e2ee_lab_bootstrap` worker supports initial
  bootstrap/media only, **not** Function lifecycle upgrades or pilot
  variables. Never use the legacy `mosaic_oracle_scratch_release` operator:
  that targets normal Appwrite Preview, not this lab.
- **Next gated work:** add a dedicated exact-source/CI-validated lab-only
  Function release and narrowly owner-approved synthetic allowlist control,
  using the Oracle plugin after a reviewed root install; independently verify
  Function deployment/flags, registered Web origin, auth/MFA session, owner
  row ACLs and ciphertext-only negative tests. Test only synthetic accounts.
  Source-only encryption primitives and a READY web app are not evidence
  that Mosaic's normal Diary/tasks/chat are E2EE.
- App `dev`, app `main`, normal Appwrite Preview, and Production have no E2EE
  promotion authorization. Normal feature development remains on Appwrite
  Preview. Project-level Scratch isolation does not imply Oracle host isolation.

## Current verified gates (2026-11-20)

- New project is authorized through a **separate** root-owned Oracle key and the new typed `appwrite-scratch-lab` broker. Authenticated live counts: **zero databases, Functions, buckets and users**.
- Existing `appwrite-preview` retains `life_tracker` and active `message-action` deployment `6b00628e0cd70b9979fd`; legacy `appwrite-scratch` tool remains an alias to the same existing Preview project.
- The owner reported entering an overly broad 29-scope lab key including `keys.read/write`, `sessions` and `migrations`. Treat as **temporary provisioning credential**, not an approved permanent least-privilege operator credential. Independently restrict/rotate/revoke after initial bootstrap. The key was never pasted into ChatGPT.
- The live Oracle plugin **cannot yet run** the Git-owned full bootstrap or create Function deployments on the new lab. A separately reviewed fixed-source, project-pinned root worker must be installed; do not ask the owner to paste credentials or expose generic shell/Appwrite HTTP access through MCP.
- Project-level isolation does not protect a shared Oracle Appwrite instance/host from overload, disk exhaustion or global service failures.

## Git-owned empty-project bootstrap contract

This security branch introduces an explicit `--e2ee-scratch-lab` option for the existing `scripts/bootstrap-mosaic.mjs` utility. It **requires**:
- Exact project `6b00671500279e901846` and exact HTTPS endpoint `https://129-221-244-67.sslip.io/v1`.
- Explicit `--no-env-file`, localhost-only Web platform, fixed `message_action` and `dr_backup` function IDs; **no DR** and no `--platform-only`.
- The existing all-four-resource empty-target preflight, before any resource mutations.
- Every managed Mosaic table from the exact Git manifest, including E2EE owner/Diary pilot tables, secure task image bucket, and default-OFF E2EE Function variables.
- **No scheduled Function jobs.** The lab's new `message-action` Function overrides the normal `0 * * * *` schedule with empty string. Only the new empty lab may use this override.
- Readback of database/tables/indexes/storage/Function readiness from the exact target following bootstrap. A partially failed bootstrap **does not** authorize automated delete/reset; investigate first and use a separately reviewed disposal plan.

Canonical source-only synthetic tests: `node --test scripts/tests/e2ee-lab-bootstrap.test.mjs`, included in `npm run contracts:check`. These are not live backend success.

**Reviewed command for a future fixed root worker, not for the owner to run manually with pasted key:**

```bash
# Called from an immutable, verified Git SHA in a dedicated root worker on Oracle.
# A root-only process provides APPWRITE_API_KEY securely from the lab key store.
node scripts/bootstrap-mosaic.mjs \
  --e2ee-scratch-lab \
  --project 6b00671500279e901846 \
  --endpoint https://129-221-244-67.sslip.io/v1 \
  --no-env-file
```

## Next environment tasks

1. Review and install the **new lab-only** source-pinned bootstrap lifecycle worker. It must verify exact owner-provided project, source branch/SHA + successful CI, key isolation, package integrity and Node runtime, and reject all old Preview/TEST/Production projects. No user-chosen script, command, endpoint, branch or archive.
2. With exact lab key, run the full bootstrap once, verify ACL/column/index/Function/bucket state and no cron; ensure the E2EE encrypted binary bucket `private_owner_media_v1` is provisioned by reviewed additive migration.
3. Register the exact E2EE Preview Web hostname in the new project with a reviewed origin check, and issue controlled synthetic-only owner/MFA accounts.
4. Change **only E2EE security branch** Vercel routing (prefer separate Vercel project) with fail-closed project+endpoint+Function binding. Never modify shared stable Preview/dev Vercel environment variables.
5. Continue E2EE M2–M5: finish direct legacy plaintext-write closure, social/message encryption and staged migration. Run real browser, old-PWA, network, backup, cross-device and negative security tests before acceptance.
6. Scrub/revoke or replace the 29-scope bootstrap key with reviewed minimal task-scoped credentials. Production, main, and dev promotion require independent explicit owner authorization.

Do **not** interpret a successful fresh-project bootstrap, a READY deployment, or normal application login as evidence of end-to-end encrypted user data.
