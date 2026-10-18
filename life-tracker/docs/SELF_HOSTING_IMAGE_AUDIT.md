# Self-hosted Appwrite image compatibility audit (#975)

Status: **non-deploying test utility**, no OCI project, backend switch, production
credentials, or server compatibility accepted by this page. The matching [host preflight, setup, and basic health probe](SELF_HOSTING_ORACLE_POC.md)
are delivered alongside this audit in the unified isolated Preview. See [#975](https://github.com/carlers/mosaic-life-tracker/issues/975)
for the migration plan and [#968](https://github.com/carlers/mosaic-life-tracker/issues/968)
for eventual NAS/cloud active-passive exploration.

## What this checks

After using Appwrite's **official version-pinned installer** to generate a synthetic-only
Compose stack (no real data), run from life-tracker/ on a machine with Docker CLI v2
and network access to the relevant image registries:

    npm run selfhost:images -- --compose /path/to/appwrite/docker-compose.yml --arch arm64 --json

For an x86_64 NAS/laptop recovery candidate, use --arch amd64 instead. To
probe an extra **exact upstream** image reference for a spawned Appwrite Function
runtime that is not in the Compose manifest, supply --image <image:tag>, repeatable:

    npm run selfhost:images -- --arch arm64 --image <verified-runtime-image-reference>

Never guess runtime image references from a Node version: inspect the actual generated
Appwrite executor configuration or the running disposable target's runtime manifest.
The tool does not invent or discover those dynamic images automatically.

The audit runs only docker compose config and docker manifest inspect --verbose:
- It **does not** pull, start, build, execute, retag, or update any container.
- It never writes to Appwrite, a registry, Oracle or Production.
- It extracts service/image/platform information from Compose JSON without printing
  expanded .env values, bearer tokens, or its raw Compose configuration.
- Each image reports supported, unsupported, or unverified for linux/arm64 or
  linux/amd64. Unknown registry responses, missing metadata, local-only builds,
  and incompatible explicit Compose platform pins **block** acceptance.
- This is a registry *metadata* check. Docker's manifest inspection command is
  experimental; a single-platform image may not advertise its OS/architecture.
  In those cases the result remains **unverified** rather than falsely passing.
- Credentials for private registries, if necessary, must be managed with Docker's
  ordinary local credential store. Do not paste them into a chat or commit them.
- All supported manifests are necessary but **not sufficient**: test full Appwrite
  runtime/Functions on a real ARM64 host. Tags may change upstream; record digests
  before declaring a reproducible rollback/restore candidate.

## Remaining real-service acceptance

Use isolated synthetic identities only. Test Docker Compose services plus dynamically
spawned Node 18 and Node 22 runtime/build images; compare the Appwrite Cloud SDK/API
version against the candidate self-host API; verify TablesDB, Auth, Storage, Realtime,
Function schedules/webhooks and private row/file permissions. Collect RSS/CPU/disk,
requests and p95 latency under realistic load and during R2 backup/restore.

Never conflate a passing Docker manifest audit with Oracle **Always Free**
eligibility, capacity availability, acceptable performance, security audit or
successful cross-host recovery. The migration remains blocked until those gates
pass and the owner separately approves a real-data cutover.

References: [Appwrite self-host installation](https://appwrite.io/docs/advanced/self-hosting/installation),
[Docker manifest inspection](https://docs.docker.com/reference/cli/docker/manifest/inspect/).
