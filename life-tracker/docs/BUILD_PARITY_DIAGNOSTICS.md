# GitHub CI / Vercel build parity diagnostics (#592)

This is a read-only diagnostic, **not** a replacement for canonical CI or a delivery gate.
Exact source-tree equality does not imply the same Vite bundle when effective build
features, Node version, build-time defines or Vercel environment variables differ.

## Observed incident (2026-10-12)

The following are **same-commit**, full GitHub `canonical-acceptance` green / hosted
Vercel size-guard red pairs. Values are hosted minus GitHub:

| SHA | GitHub run | Vercel ID | entry raw | entry gzip | initial gzip | Home gzip | assets raw | assets gzip | precache |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| `e418b9fc` | 38253738347 | `dpl_T5hZfVAMooPGTKMjKAVP92xg51JW` | +164 | +98 | +98 | +140 | +2214 | +1002 | +2214 |
| `10e8e0e9` | 38250639343 | `dpl_DKxAZudNPXE7wB96LVBHHgc9B4w9` | +164 | +98 | +98 | +140 | +2214 | +1003 | +2214 |
| `5d049204` | 38251884539 | `dpl_AoSnuyCFaM23GqHQueTYUCPmHDE8` | +164 | +97 | +97 | +139 | +2214 | +998 | +2214 |

Vercel logs report **GIPHY enabled**, via a shared Preview-scoped Vercel variable;
GitHub's build has no corresponding configured GIPHY key. Vercel's project Node
version was **24.x**, while the previous GitHub build job used **22.x**. These are
two independently evidenced build-context differences. The repeated 2,214-byte
aggregate delta is consistent with different bundled feature code, but without
controlled builds and file hashes do **not** assert that GIPHY explains every byte.

## Inspect comparable logs without exposing environment secrets

Download **the build job logs** for exact GitHub SHA and matching Vercel deployment
to local temporary files (do not commit, upload or paste unredacted logs).
Run from `life-tracker/`:

```bash
node scripts/compare-build-logs.mjs /tmp/ci.log /tmp/vercel.log \
  <40-character-ci-sha> <40-character-deployment-sha>
```

The command extracts only seven measured bytes, the *presence* of GIPHY from
the explicit build-feature line, major Node version, and Vite version. It does
not display or store API key values or raw JavaScript. Nonzero means mismatch
or incomplete evidence. Older GitHub logs have no feature/runtime banner;
their status will be `unverified` if metrics happen to agree. This is deliberate.

CI build runtime should match the Vercel project Node 24.x. The build process
emits sanitized `[Mosaic] Build features` and `[Mosaic] Build runtime` lines on
official hosted builds and GitHub Actions. A matching size report is **not**
proof of identical artifacts; compare generated JS/CSS by stable Vite manifest
keys and hashes under controlled builds, *never by hashed filename alone*.

## Required before gating Vercel on CI (#592 next phase)

1. Rebuild pinned incident commits in a controlled matrix of Node 22/24 and
   GIPHY absent/present, while preserving Scratch-only Preview backend identity,
   and identify exactly which chunks account for the 2,214-byte difference.
2. Make canonical CI verify the **effective Vercel Preview build** under a
   trusted secret-scoped workflow; a public fake GIPHY key proves *structural*
   attribution only, not exact production-key byte parity. Never expose tokens,
   decrypted Vercel API response data, or bundled secret-bearing artifacts.
3. Check whole-tree/effective-config SHA, required canonical checks, and deployed
   branch aliases; a green build sub-job alone is insufficient if tests fail.
4. Canary a CI-green exact-SHA Preview under the existing automatic-deployment
   policy before disabling *any* stable branch auto deployment. Test stale SHA,
   CI failure, missing credential, wrong Scratch target and idempotent retries.
5. Never disable `dev`/`main` auto deployment or change Production/Appwrite
   as part of this diagnostic. Do not weaken seven size budgets until repeatable
   effective hosted build measurements establish appropriate release limits.

References: [Delivery](DELIVERY.md), [AI workflow](AI_WORKFLOW.md),
[issue #592](https://github.com/carlers/mosaic-life-tracker/issues/592).
