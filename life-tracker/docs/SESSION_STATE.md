# Session checkpoint

Updated: 2026-09-24
Current task: Correct Vercel automatic-deployment configuration
Status: implementation complete; final canonical verification is required via the `[verify:full]` gate.
Next action: run focused contract/diff checks, commit with [verify:full], wait for canonical acceptance, fast-forward Preview, and verify deployment.
Blockers: Vercel deployment status must be verified externally after the accepted SHA is published.

## Constraints

- Release versions are deliberate Semantic Versioning product releases, not commit/deployment counters.
- Build identity is separate from release version and uses the exact deployment Git SHA when available.
- Preview remains deployment-only; the exact SHA deployed is the build identity shown by the app.
- Preserve existing PWA lifecycle behavior and update-check contract.

## Completed substeps

- Adopted `0.1.0` as Mosaic's initial development release version.
- Added a documented release-version protocol in `docs/VERSIONING.md`.
- Added build metadata injection from Vercel Git environment values with local fallbacks.
- Exposed channel and short build identity in Settings.
- Updated version/build regression coverage and project-reference documentation.

## Remaining substeps

- Verify the effective Vercel config is under the configured `life-tracker` Root Directory.
- Run `npm run contracts:check` and `git diff --check`.
- Run final [verify:full] acceptance and publish the exact accepted SHA to Preview.
- Verify the resulting Vercel deployment.

## Working set

- life-tracker/vercel.json
- docs/DELIVERY.md
- package.json
- package-lock.json
- src/lib/appVersion.ts
- src/lib/buildInfo.ts
- vite.config.ts
- src/pages/SettingsPage.tsx
- tests/unit/appVersion.test.ts
- tests/components/SettingsPage.test.tsx
- docs/VERSIONING.md
- docs/README.md
- docs/PROJECT_REFERENCE.md
- docs/SESSION_STATE.md

## Verification

- Focused checks are covered by the final [verify:full] canonical acceptance.
- Browser/device acceptance: no new device-specific behavior; Settings build metadata should be visually checked on Preview after deployment.
