# Session checkpoint

Updated: 2026-09-28

Current task: finish hosted acceptance for the TodoMate photo migration after the user's
live preview showed all 37 TodoMate photos ready but restore was blocked by a long-running
sync.

Stable Preview branch: `feature/todomate-importer`.

## Live TodoMate evidence
- Original migration already succeeded with 505 tasks, 13 categories, 1 diary entry, and
  3 undated tasks placed on the import day.
- The photo-capable Preview subsequently reported **37 of 37** TodoMate photo attachments
  ready to copy.
- The first photo import attempt stopped before restore writes because Mosaic could not
  establish the required fresh-sync preflight; the user also observed the sync indicator
  remaining on Syncing.

## Sync/restore fix now on stable Preview
The stable branch already contains the accepted sync fix:
- `914dd25793349e54dfd608a98bb430df9dc6d8de` —
  `fix: unblock restore preflight during long sync`
- `a7561da6ca11bef096988f98f0ec37b4a02035db` —
  `docs: clarify TodoMate fresh-sync wait`

The fix:
- adds `refreshSync()` as an explicit freshness barrier for restore/import;
- waits for this tab's queued/running sync coordinator to drain before starting one new
  serialized cycle;
- keeps the fail-closed freshness/error checks;
- bounds independent dirty-row pushes to four concurrent workers per collection while
  preserving collection ordering, per-row `updateRow` → 404 `createRow`, Web Locks,
  permissions, dirty boundaries, and failure accounting.

Stable Quality Gate 1305 passed at
`a7561da6ca11bef096988f98f0ec37b4a02035db`, including build, lint/unit/handlers,
both DOM shards, both browser-contract shards, dependency audit, and canonical acceptance.

## Deployment blocker found
Vercel Git deployments for both stable sync commits failed at `npm run build` even though
GitHub built the exact stable SHA successfully:
- `914dd257...` → Vercel ERROR
- `a7561da6...` → Vercel ERROR

The connected Vercel deployment record exposes only `BUILD_UTILS_SPAWN_1` /
`npm run build exited with 1`; its build-log endpoint is currently unavailable from this
tool session.

Repo inspection found one real Vercel-only build-contract mismatch:
- docs define PostHog source-map upload as optional **production** delivery and require
  Preview builds not to depend on stale external upload credentials;
- `vite.config.ts` previously enabled `@posthog/rollup-plugin` in Preview whenever
  `POSTHOG_SOURCE_MAPS_ENABLED=true` plus the build credentials were present.

Current working branch: `chatgpt/vercel-preview-build-fix`, based on stable
`a7561da6ca11bef096988f98f0ec37b4a02035db`.

## Preview build hardening
- `vite.config.ts` now forces the PostHog source-map upload path off whenever
  `VERCEL_ENV=preview`.
- Production and explicitly opted-in local builds retain the existing upload path.
- Browser-facing PostHog Preview configuration remains unaffected.
- `posthogBuildContract.test.ts` pins both the explicit opt-in and Preview isolation.
- `DELIVERY.md` and `PROJECT_REFERENCE.md` now match the runtime contract.

This change is intentionally narrow: it does not alter Mosaic runtime behavior, sync
semantics, TodoMate mapping, or production source-map delivery.

## Remaining
1. Run exact-SHA full canonical acceptance for the Preview build hardening.
2. Squash-deliver it to `feature/todomate-importer`.
3. Verify the resulting Vercel Preview deployment becomes READY.
4. If it still fails, continue provider-specific diagnosis; do not hand the user a stale
   Preview.
5. Once hosted-ready, user refreshes the stable Preview, reruns **Preview Transfer**
   (expected 37/37 ready), then **Import into Mosaic**.
6. Verify import completion, sync settles, no duplicate tasks appear, and several restored
   photos render from Mosaic/Appwrite Storage.
7. Only then mark the TodoMate photo enhancement complete.

## Separate DR follow-up
- DR work is already merged into `dev`.
- Production `dr_backup` remains scheduled at `0 11 * * *`.
- External GitHub stale-backup monitoring still requires default-branch
  delivery/configuration; do not promote to `main` without explicit user authorization.

Next action: run the full gate for the Preview build hardening, deliver it to the stable
Preview branch, and verify Vercel.
