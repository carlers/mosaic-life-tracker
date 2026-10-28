# Oracle self-hosted Appwrite isolated test recovery (#975)

GitHub issue [#975](https://github.com/carlers/mosaic-life-tracker/issues/975) is the operational resume checkpoint. This runbook belongs only to the **disposable Oracle test project**, not Appwrite Cloud Scratch/Production or Supabase.

## State verified 2026-10-28

- Oracle A1 2 vCPU/12 GB ARM64 with Appwrite 2.6.2 PostgreSQL backend, private SSH-tunneled Console, checked root registration, restricted on-VM GitHub Actions runner in private `carlers/mosaic-server-ops`. No public OCI 80/443 ingress.
- Private project-scoped `databases.read` reader key proved HTTP 200 on local TablesDB; users/storage metadata probes returned HTTP 401. No read key widening.
- `life_tracker` database created on private ops workflow #40669484700; confirmed HTTP 201 and 200 readback. Exact Git-owned source `life-tracker/infrastructure/mosaic-backend.mjs`.
- Full schema bootstrap #40670863554 created **14 tables and `task_images` bucket**, then failed at `message-action` creation with `Runtime "node-18.0" is not supported`. Never rerun the full bootstrap against this partially populated project.
- Appwrite 2.6.2 stock `.env` enables Node 22 only. Mosaic's canonical Function uses Node 18. Private owner-only helper `carlers/mosaic-server-ops/ops/enable-node18-fedora.sh` is needed to enable Node 18 alongside Node 22, without changing client/Production Function runtime. First helper was too strict about quoted/space-delimited runtime settings and exited **before mutation**; fixed in private ops PR #9 at `8aa7c0ea23f67417033854af61157893d021052b`. Owner must run only the fixed, SHA-pinned helper and verify `MOSAIC_NODE18_PRIVATE_TEST_HOST_READY`.

## Exact one-shot Function-only recovery

`scripts/repair-oracle-message-function.mjs` uses the Git-owned canonical `provisionFunction` from `scripts/lib/mosaic-bootstrap.mjs`, not a Console-authored approximation. It is **not** part of normal production backend development or provider migration.

It refuses all targets except project `6ae1bf2e00034572451b` at `http://localhost/v1` and requires explicit `--confirm-project`. Before any write it checks exactly one Git-owned database, exactly one `task_images` bucket, zero users, zero Functions; runs the read-only canonical `inspectManagedBackend --without-dr` equivalent, requiring the **only** drift to be `function message-action: missing`, and checks that source Function config still uses ID `6aa8057f002a4c306fdd` and runtime `node-18.0`. This is the original canonical Function ID; the default fresh-bootstrap CLI fallback `message_action` was never the intended stable ID.

After successful preflight, it invokes the canonical packager/deployer once, sets the DR privacy flag `false`, keeps the Function schedule disabled while testing, adds only a missing localhost Web platform, and verifies full Git-owned drift convergence. On a build failure or partial Function state it will **not retry the write** automatically. Its CLI suppresses raw exception/build logs in Actions because they may contain private operational data.

Live execution requires a **separate** private ops workflow pinned to the exact reviewed task commit, with private environment secret `ORACLE_TEST_PROVISION_API_KEY`, owner-only manual dispatch, exact project and approval guards. No Function recovery workflow has been executed yet. A successful deployment must still receive synthetic Function execution, auth/isolation, Realtime, media and device/client acceptance before any real data is copied. Do not merge this task source into dev/main without accepted gates/explicit permission.

## Mandatory outstanding gates

Permanent HTTPS/domain, root-owned encryption-key escrow, independent off-VM encrypted DB/media/config backups and **tested restore**, SMTP/password reset, runtime architecture builds, capacity/OOM monitoring, OCI alerting, GitHub runner removal/isolation before Production data, full account/row/file migration reconciliation, and separately approved Production promotion/cutover remain outstanding. OCI PAYG budget warnings are not hard spending caps. Never expose HTTP or root Appwrite credentials to make a ChatGPT connector work.
