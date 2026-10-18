# Mosaic Function runtime proof on ARM64 (#975)

The earlier [native ARM64 stack-image proof](SELF_HOSTING_ARM64_RUNNER_PROOF.md)
passed real pulls of ten Appwrite 2.5.0 images and a restricted
Appwrite shell process. This second experiment targets the actual
Node runtimes needed by Mosaic's unchanged Function definitions.

## Function requirements

| Function | Appwrite runtime ID | OpenRuntimes image |
|---|---|---|
| `message-action` | `node-18.0` | `openruntimes/node:v5-18.0` |
| `dr-backup` | `node-22` | `openruntimes/node:v5-22` |

IDs are from `appwrite.config.json` and each Function's
`function.config.json`. Appwrite 2.5.0 upstream's versioned `.env`
enables only `_APP_FUNCTIONS_RUNTIMES=node-22` by default and lists
only the Node 22 image. To test both unchanged Mosaic Functions, the
disposable installer configuration should explicitly set:

```dotenv
_APP_FUNCTIONS_RUNTIMES=node-18.0,node-22
_APP_EXECUTOR_IMAGES=openruntimes/node:v5-18.0,openruntimes/node:v5-22,openruntimes/static:v5-1
```

These are **proposed synthetic-test values**, not a production
configuration change. Confirm against the generated installer and
runtime APIs before using them. Node 18 is end-of-life: migrating
`message-action` to Node 22 warrants separate security and
compatibility review, never an implicit live Function change.

## Synthetic ARM64 check

The branch-only
[`selfhost-arm64-function-runtimes.yml`](../../.github/workflows/selfhost-arm64-function-runtimes.yml)
uses GitHub's native `ubuntu-24.04-arm` runner. Both pinned
runtime images are pulled for `linux/arm64`, Docker-inspected,
and each executes a real synthetic Node process under a 2-CPU,
512-MiB container limit. The process checks Node major version,
SHA-256 and Buffer operations. Containers have no network,
mounts or elevated privileges, and receive no credentials.

This does **not** execute Mosaic handlers in Appwrite, build
npm dependencies, exercise the executor, validate database access,
verify scheduling, or establish 2-OCPU/12-GiB backend capacity.
Full isolated Appwrite with synthetic users, Functions and R2 recovery
must still be tested before migrating any real accounts.

References: [Appwrite 2.5.0 upstream environment](https://github.com/appwrite/appwrite/blob/2.5.0/.env),
[Function runtime configuration](https://appwrite.io/docs/advanced/self-hosting/configuration/functions),
[Supported runtime IDs](https://appwrite.io/docs/products/functions/runtimes).
