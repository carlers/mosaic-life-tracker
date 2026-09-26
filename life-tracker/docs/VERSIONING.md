# Versioning protocol

Mosaic uses two related identities for application builds:

- **Release version** — the human-facing product version, managed deliberately with
  Semantic Versioning (`MAJOR.MINOR.PATCH`).
- **Build identity** — the exact artifact/deployment identity, generated automatically
  from the Git commit used to build the app.

These identities answer different questions. The release version describes the product
release; the build identity identifies the exact application artifact. A new build does
not automatically imply a new release version.

## Release version

Mosaic follows the Semantic Versioning 2.0.0 shape `MAJOR.MINOR.PATCH`. During initial
development (`0.y.z`):

| Change | Version action |
|---|---|
| New backwards-compatible product capability or meaningful feature | Increment **MINOR** and reset PATCH to `0` |
| Backwards-compatible bug fix | Increment **PATCH** |
| Breaking compatibility change after the product reaches `1.0.0` | Increment **MAJOR** and reset MINOR/PATCH to `0` |
| Docs, tests, CI/CD, tooling, or internal-only changes | Do not bump the release version |

For the current development phase, Mosaic starts at **`0.1.0`**. The version is a
deliberate release decision, not a counter of commits or deployments.

A release version is recorded consistently in:

- `life-tracker/package.json`
- `life-tracker/package-lock.json`
- `life-tracker/src/lib/appVersion.ts`

These values must remain equal.

## Build identity

Every production build embeds:

| Field | Meaning |
|---|---|
| `version` | Release version at build time |
| `buildId` | Full Git commit SHA when built by Vercel; `local` for local builds |
| `commit` | Full Git commit SHA, or absent for local builds |
| `commitShort` | First 8 characters of the commit SHA for compact UI |
| `commitMessage` | Git commit message supplied by the deployment provider, when available |
| `builtAt` | UTC build timestamp |
| `channel` | `Preview`, `Production`, or `Local` |

Vercel supplies the deployment Git SHA, branch, and commit message through its system
environment variables; the Vite build injects those values into the client bundle.
The build metadata is diagnostic information, not a secret.

The Settings page displays the release version plus the deployment channel, branch, short
commit identity, and commit message when available. This lets a user report an exact build
without treating the Git SHA as the product version.

## Branch deployment channels

Build identity remains independent from the Semantic Versioning release version. Vercel supplies
the deployment Git SHA, branch, and commit message through its system environment variables.

- `main` is the Production deployment channel.
- `dev` is the integration/staging Preview deployment channel.
- `feature/*` branches are stable Preview deployment channels.
- `chatgpt/*` and `codex/*` branches do not receive automatic Vercel deployments.
- Other branches do not receive automatic Vercel deployments.

The legacy `preview` deployment-only branch is no longer part of the deployment model.
See `docs/DELIVERY.md` for the current branch and CI policy.

## PWA relationship

The service worker remains responsible for detecting/installing an updated app shell.
Version metadata does not replace the PWA lifecycle and does not make Git commits
themselves into PWA updates.

A release version bump normally changes the app build. A deployment also gets a unique
build identity, so the Settings diagnostics can distinguish two builds that intentionally
share the same release version.

## Release examples

```text
0.1.0
  ├─ docs-only commit            → 0.1.0
  ├─ CI/test-only commit         → 0.1.0
  ├─ bug-fix release             → 0.1.1
  └─ new feature release         → 0.2.0

0.2.0 + build b7bfa9c6...
0.2.0 + build c91e42a1...
```

The two `0.2.0` builds are different artifacts but the same product release.

## References

- [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)
- [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
