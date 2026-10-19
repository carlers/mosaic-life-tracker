# Oracle Always Free: isolated Appwrite self-host proof (#975)

Status: **source-only preparation**; not a running OCI VM, production migration, or approved provider switch.
This runbook is for a **new disposable deployment with synthetic Mosaic data only**.
See [Appwrite backend workflow](APPWRITE_BACKEND_WORKFLOW.md), [DR](DISASTER_RECOVERY.md),
[client/backend compatibility](CLIENT_BACKEND_COMPATIBILITY.md) and [issue #975](https://github.com/carlers/mosaic-life-tracker/issues/975).
The optional cloud+NAS/laptop dual-server discussion remains [#968](https://github.com/carlers/mosaic-life-tracker/issues/968).

If Singapore AD-1 has no available `VM.Standard.A1.Flex` hardware, the [local OCI capacity watcher](OCI_CAPACITY_WATCH.md) can query the official advisory capacity report without attempting VM launches or changing the tenancy. It cannot guarantee free capacity and requires local CLI authentication.

## Provider limits / go-no-go

Oracle's published Always Free Ampere A1 allowance is 1,500 OCPU-hours +
9,000 GB-hours per month (2 OCPUs / 12 GB continuously on an Always Free tenancy).
The shared boot/block volume allowance is 200 GB; other VM/transfer quotas apply.
Verify **Always Free Eligible** in the chosen home region, free compute availability,
boot-volume sizing and billing settings **in the operator's OCI account** before
creating anything. Nothing in this repository provisions OCI or authorizes a paid shape.

The Appwrite self-host installation minimum is 2 CPU cores, 4 GB RAM, 2 GB swap,
Docker and Compose v2. OCI's 2-OCPU shape has no guaranteed headroom for the
database, Redis, ClickHouse, workers, Functions and backups. Do not confuse
passing a minimum prerequisite gate with proving production readiness.

Authoritative references (recheck when executing):
- [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Appwrite Docker installation](https://appwrite.io/docs/advanced/self-hosting/installation)
- [Appwrite Cloud-to-self-host migration](https://appwrite.io/docs/advanced/migrations/cloud)

**SDK compatibility gate:** Mosaic's current browser SDK is `appwrite:^26.2.0`;
Appwrite's [self-host installation SDK table](https://appwrite.io/docs/advanced/self-hosting/installation)
associates Appwrite 2.5.0 with Web SDK 27.0.0 and Web SDK 26.2.0 with
Appwrite 1.9.6. This does **not** establish actual incompatibility; verify
Appwrite TablesDB, Auth, Storage, Realtime and Function behavior with the exact
existing and target SDK/server versions using synthetic data before deciding on
a separately reviewed client SDK change.

Before installing, account for [Mosaic's required Node 18/22 Function runtimes](SELF_HOSTING_FUNCTION_RUNTIMES.md). Appwrite 2.5.0's default config enables only Node 22. The `node-18.0` Function must not disappear during a provider migration.

The [native ARM64 datastore smoke](SELF_HOSTING_ARM64_DATASTORES.md) separately checks PostgreSQL, Redis and ClickHouse initialization and synthetic data roundtrips on an isolated runner, without certifying Appwrite API or OCI VM performance.

## Phase A — safe isolated OCI candidate

1. Use a dedicated non-production OCI compartment, Ubuntu **ARM64** VM.Standard.A1.Flex,
   **2 OCPU / 12 GB** and an Always Free-eligible boot volume. Enforce OCI account
   quotas/alerts; do not assume alerts cap costs. No Mosaic accounts or Production secrets.
2. Limit network ingress: SSH only from an approved admin source (prefer an authenticated
   private access path), HTTPS 443 for API/Realtime; HTTP 80 only if needed for certificate
   issuance. Never expose database, Redis, Docker daemon/socket or installer port 20080
   publicly. Keep system and Docker packages patched.
3. Install supported Docker Engine and Compose v2 following Docker's official OS guide.
   Configure **at least 2 GiB swap** and a persistent local filesystem. On the target
   VM, run from `life-tracker/`:

   ```bash
   npm run selfhost:preflight -- --json
   ```

   This read-only gate checks Linux/architecture, logical CPUs, memory, swap and the
   local Docker daemon/Compose. It does **not** install Docker, inspect all container
   architectures, inspect account billing, estimate needed disk space, or run Appwrite.
4. For a disposable stack, use the **version-pinned official Appwrite installer**,
   currently documented with `appwrite/appwrite:2.5.0`. Prefer PostgreSQL,
   **combined worker/scheduler**, and **disabled AutoGravity** as the initial
   low-resource hypothesis. Do not hand-author an incomplete or stale Compose stack.
   Keep generated `docker-compose.yml`, `.env`, ClickHouse files and persistent
   volumes together on the server, with encrypted off-server backup and restrictive
   permissions; **never commit generated secrets**. The install wizard mounts the
   Docker socket, so run only verified upstream images. Bind installer port 20080 to
   loopback and access over an SSH tunnel instead of opening it to the internet:

   ```bash
   # Run on the VM in a dedicated, disposable install directory:
   docker run -it --rm \
     --publish 127.0.0.1:20080:20080 \
     --volume /var/run/docker.sock:/var/run/docker.sock \
     --volume "$(pwd)"/appwrite:/usr/src/code/appwrite:rw \
     --entrypoint install appwrite/appwrite:2.5.0
   # From operator laptop: ssh -L 20080:127.0.0.1:20080 <vm-user>@<vm-ip>
   # Then visit http://localhost:20080 on the operator laptop.
   ```

   Compare generated environment settings against the official docs. Generate
   independent `_APP_OPENSSL_KEY_V1` and `_APP_EXECUTOR_SECRET`, store them securely
   and escrow out-of-band. Verify **every** pulled image supports ARM64, builds/executes
   Mosaic's Node 18/22 Functions and does not exceed memory/disk. Nothing above is
   evidence of successful ARM64 runtime compatibility.
5. Set a dedicated **test-only** HTTPS hostname, certificate, origin policy and synthetic
   Appwrite project. No current Vercel Preview alias may point here without the
   reviewed Scratch-isolation changes. Existing Vercel Preview uses its own Appwrite
   Scratch Cloud project and must remain so until a separately approved contract change.
6. Use existing Git-owned bootstrap on an **empty disposable project**, with a temporary
   narrowly scoped key, explicit project and target URL; never reuse Production IDs:

   ```bash
   APPWRITE_API_KEY=<temporary-key> npm run mosaic:bootstrap -- \
     --project <new-disposable-project-id> \
     --endpoint https://<test-only-appwrite-domain>/v1 \
     --web-hostname localhost \
     --no-env-file
   ```

   Then revoke the provisioning key. Bootstrap must not be used on existing/live
   projects; it deliberately rejects nonempty projects.
7. Compare `npm run appwrite:status`, synthetic service execution, Realtime, login,
   permissions, photo storage, message events, schedule handling, and encrypted DR.
   Measure RAM/CPU/IO, disk growth and p95 API latency during representative load
   **and simultaneous Function/backup activity**, plus reboot, lost network and disk pressure.


## Phase A.1 — non-destructive API health timing probe

After the disposable Appwrite instance is installed and TLS is verified, use the
strictly bounded **unauthenticated** health/version probe to get an initial
HTTP latency baseline (20 requests, concurrency 2 by default; hard caps of 100
requests and concurrency 4):

```bash
npm run selfhost:health-probe -- \
  --endpoint https://your-disposable-appwrite.example/v1 \
  --confirm-host your-disposable-appwrite.example \
  --confirm-disposable --json
```

This tool refuses Appwrite-managed Cloud endpoints, rejects HTTP except on
loopback, and requires exact hostname confirmation. Only GET
`/v1/health/version` is requested; no account/key, user data or request body is
sent or logged. All responses must return HTTP 200. Treat these measurements as
basic API/TLS reachability only, **not** p95 task CRUD/Realtime performance,
Appwrite/SDK compatibility, sustained load, or 2-OCPU capacity acceptance. Run
representative authenticated synthetic workload checks separately and measure
CPU/RAM/swap/IO, backup collisions and failure/reboot recovery.

Before installing the stack, run the [image architecture audit](SELF_HOSTING_IMAGE_AUDIT.md)
on the official *generated* Compose configuration, checking all dynamically
spawned runtime images separately. The audit is not an ARM64 runtime execution.

## Phase B — portability and recovery proof

- Test restoration to a *different isolated* machine (x86-64 VPS, NAS or laptop with
  sufficient Docker/SSD resources), using the **same supported Appwrite/database release**
  and explicitly escrowed secrets. Cross-architecture container compatibility must
  be verified; copying a running database directory to unlike software versions is **not**
  a supported migration strategy by assumption.
- Existing `mosaic-dr/v1` encrypted R2 backups, independent credentials, key rotation
  and non-resurrection privacy-deletion markers remain mandatory. Verify a fresh
  completed snapshot + restored account IDs, row and file hashes, schemas, permissions,
  Function activation and signed-in offline/reconnect flows.
- Appwrite Cloud migration **resets `$createdAt` and `$updatedAt`**. Test
  Mosaic's *application-level* timestamps and RxDB cursors separately. Password/session,
  file permissions, callback/webhook, HTTPS origin, encryption key and Function config
  parity are not implied by migration success.
- One authoritative writer only. Do not start two independently writable Appwrite
  backends; active-passive fencing and active-active sync belong to separate #968 work.
  Currently installed PWAs embed their Appwrite Cloud API URL; switching a DNS record
  cannot repoint those compiled clients. See #914 compatibility requirements.

## Acceptance / hard stops

**Stop** if OCI cannot supply genuinely Always Free capacity, any required ARM64 image or
Function fails, minimum prerequisite checks fail, real memory/CPU/disk headroom is
insufficient, backup/restore or user-isolation tests fail, or latency is unacceptable.
Compare a paid x86 VPS before relaxing safety requirements.

This phase never copies real users or data, switches live endpoints, mutates current
Scratch/Production, creates a public Preview, or promotes to dev/main. Production
cutover requires a tested write freeze, offline-client compatibility, consistent transfer,
verification, a rollback that accounts for new writes, and separate explicit approval.
