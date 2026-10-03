# Session checkpoint

Updated: 2026-10-03
Current task: Audit and reduce Mosaic production bundle/startup/Home closure size on `perf/build-size-audit` without changing product behavior or the offline-first PWA contract.
Status: Implementation is on `chatgpt/build-size-audit`. The measured startup and Home graph has been reduced materially, build tooling is correctly classified as dev-only, six unreachable legacy source files were purged, and the build-size guard now protects initial/Home static closures in addition to entry/aggregate/precache size. Final exact-SHA canonical verification and stable Preview promotion remain.
Next action: Remove temporary branch-only bundle diagnostics from the Quality Gate workflow, run the final exact-SHA full canonical Quality Gate, fix any failure, merge the task branch into `perf/build-size-audit`, verify the stable Preview deployment, then clean up the task branch if safe.
Blockers: None known.

## User prompt

Branch from latest `dev` into `perf/build-size-audit`; comprehensively measure production bundle/chunk/module/static-closure/PWA precache size, identify reachable dead code, unused dependencies, and safe lazy-loading opportunities, then purge/optimize only measured wins. Preserve product behavior and offline capability. Improve the build-size guard with initial/Home closure gzip budgets if justified, update stale §24.14 documentation, and finish with the canonical Quality Gate plus Preview verification.

## Progress

1. Branched stable `perf/build-size-audit` and task `chatgpt/build-size-audit` from `dev` SHA `10bbf772`.
2. Measured the unchanged baseline production graph:
   - entry: 540,958 B raw / 163,476 B gzip
   - initial closure: 593,650 B raw / 176,736 B gzip
   - Home closure: 1,265,306 B raw / 391,358 B gzip
   - aggregate app assets: 2,194,495 B raw / 665,971 B gzip
   - unique PWA precache: 2,267,339 B
3. Removed Framer Motion from the shared eager `Button` primitive while preserving the 0.95 press state with CSS. Measured startup reduction:
   - entry gzip: 163,476 -> 125,232 B
   - initial closure gzip: 176,736 -> 136,790 B
4. Deferred Home-only settings/category/menu sheets and removed Framer Motion from Home search while preserving search entrance motion in CSS.
5. Latest measured production graph at `9ca52e2`:
   - entry: 423,122 B raw / 125,240 B gzip
   - initial closure: 472,803 B raw / 136,883 B gzip
   - Home closure: 1,114,771 B raw / 339,955 B gzip
   - aggregate app assets: 2,195,734 B raw / 667,418 B gzip
   - unique PWA precache: 2,269,326 B
6. Reclassified `repomix` and `vite-plugin-pwa` as development dependencies and refreshed lockfile ownership. Production dependency audit is green; the newly reported vulnerable `braces` and `serialize-javascript` paths are confirmed dev-only.
7. Extended `scripts/audit-bundle.mjs` with production source reachability and declared-dependency attribution.
8. Added Vite manifest emission for post-build graph measurement while excluding the manifest from Workbox precache.
9. Extended the build-size guard to seven metrics, adding initial-closure and Home-closure gzip budgets; added durable unit coverage.
10. Purged six source files confirmed outside the production graph with no live consumer: `TopBar.tsx`, `EditTaskSheet.tsx`, `AppearanceSettingsSheet.tsx`, `useImageCompression.ts`, `mockData.ts`, and `TestPlayground.tsx`. This is source cleanup only, not claimed as emitted-byte savings.
11. Kept `useDiary.ts` and `useFeatureFlag.ts` because they retain dedicated tests/contracts despite not currently being route-reachable.
12. Updated `PROJECT_REFERENCE.md` §24.14 and the reviewed size baseline/limits. Home closure ceiling is tightened to 357,000 B gzip; prior aggregate/precache ceilings were not raised.

## Verification

- Baseline `dev` SHA `10bbf772`: canonical Quality Gate passed; Vercel deployment READY.
- Intermediate optimized builds: TypeScript/build, unit/checks, DOM shards, and browser-contract shards have passed.
- Dependency audit after lockfile ownership refresh: passed.
- Final exact-SHA canonical acceptance: requested on the final task-branch candidate.
- Stable `perf/build-size-audit` Preview verification: pending.
