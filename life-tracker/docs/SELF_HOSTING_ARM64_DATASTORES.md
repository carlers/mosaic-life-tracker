# Native ARM64 Appwrite datastore smoke (#975)

The earlier [Appwrite image proof](SELF_HOSTING_ARM64_RUNNER_PROOF.md) and
[Node Function runtime proof](SELF_HOSTING_FUNCTION_RUNTIMES.md)
validate individual ARM64 container execution. This test verifies
three real dependency services *together*, still without Appwrite itself.

The branch-only
[`selfhost-arm64-datastores.yml`](../../.github/workflows/selfhost-arm64-datastores.yml)
runs on a GitHub-hosted native `ubuntu-24.04-arm` VM.
It pulls the exact images in Appwrite 2.5.0's tagged upstream Compose:
`appwrite/postgres:0.1.0`, `redis:7.4.7-alpine`, and
`clickhouse/clickhouse-server:26.4.3-alpine`.

All three start simultaneously on an **internal Docker-only network**,
with no published host ports, no real users or data, no Appwrite/OCI keys,
no Docker socket mounts inside the containers, and CPU affinity restricted
to runner CPU indices 0 and 1. It waits for health checks and writes/reads
a synthetic PostgreSQL row, Redis key and ClickHouse row. A process exit
or synthetic value mismatch fails the test. Temporary containers are
destroyed on exit and the runner is ephemeral.

Passing would prove the selected datastore containers can initialize and
respond to trivial synthetic operations on native ARM64.
It does **not** prove they can support Appwrite's real schema, traffic,
background jobs, migrations, encrypted DR restore, account isolation,
persistent storage, full-stack startup, or sustained p95 latency.
GitHub runner hardware differs from OCI A1. A failed run needs logs to
distinguish runner resource/registry faults from service incompatibility.

This is a read-only investigation of **Mosaic's existing backend design**:
no application release, Production/Preview endpoint switch, or
database/provider migration follows automatically.
