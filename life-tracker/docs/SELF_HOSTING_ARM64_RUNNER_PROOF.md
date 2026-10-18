# Native ARM64 Appwrite container smoke — isolated GitHub runner (#975)

This is a **temporary, task-branch-only, read-only upstream container probe**. Its
purpose is to reduce uncertainty before creating an Oracle Always Free VM.
See [OCI setup checklist](SELF_HOSTING_ORACLE_POC.md) and
[full Compose image audit](SELF_HOSTING_IMAGE_AUDIT.md).

## Execution and safety

The dedicated workflow at `../../.github/workflows/selfhost-arm64-probe.yml` runs
**only** when pushed to `chatgpt/975-native-arm64-proof-20261019`. It uses
GitHub-hosted `ubuntu-24.04-arm` (native ARM64), permission `contents: read`,
no repository or environment secrets, no persistent machines, no service
deployments, and no OCI/provider calls. The job has a 20-minute ceiling.

The probe pulls **ten exact image tags** taken from the official Appwrite
2.5.0 Compose definition (PostgreSQL/combined-worker/no-AutoGravity
*assumption*), checks they are recognized as Linux ARM64, then starts
`appwrite/appwrite:2.5.0` under strict network-disabled, read-only,
privilege-reduced constraints and exits immediately after checking the
CPU architecture. The test exercises the image and an isolated container
process **not** the Appwrite service, its environment or database.

Upstream pinned source:
[Appwrite 2.5.0 Docker Compose](https://github.com/appwrite/appwrite/blob/2.5.0/docker-compose.yml).
Workflow image tags are explicitly selected and cannot establish a complete
installer-generated topology. Appwrite dynamically starts additional
Functions/runtime/build containers; this probe does not identify or exercise
their Node 18/22 images. Optional MariaDB/MongoDB, AutoGravity and embedding
services are excluded. The result is **not** a Production certification.

A failed registry pull can also be caused by network outages, rate limiting,
expired tags or runner issues. Review exact logs; do not automatically
attribute every failed pull to CPU incompatibility.

## What a green run means

A green run establishes that the **selected ten pinned images** are
retrievable for Linux ARM64 from GitHub's runner network, and the
`appwrite/appwrite:2.5.0` image can execute a native ARM64 shell.
It **does not** prove a complete Appwrite deployment runs, 2-OCPU performance,
persistent storage, all Docker services, API/SDK parity, user isolation,
Functions runtime support, password/session migration, backups, NAS recovery
or OCI free pricing/availability.

Follow up using the unified isolated tools on
`refactor/975-unified-offline-readiness-20261019` and run the actual
official 2.5.0 installer, `selfhost:preflight`, `selfhost:images`, guarded
`selfhost:health-probe`, synthetic Mosaic bootstrap and cross-host recovery.

GitHub publishes standard native Arm runners for public repositories:
[GitHub Actions ARM64 availability](https://github.blog/changelog/2025-08-07-arm64-hosted-runners-for-public-repositories-are-now-generally-available/).
This native runner is not an Oracle instance, and its CPU/memory/storage
configuration differs from Always Free A1. No promotion to `dev`,
`main` or real backend cutover is authorized by this test.
