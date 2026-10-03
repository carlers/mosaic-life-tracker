# Session checkpoint

Updated: 2026-10-03
Current task: Production bundle/dead-code/dependency audit and purge on `perf/build-size-audit`.
Status: Complete. The implementation was promoted to stable `perf/build-size-audit` as `378f5f42`; its full canonical Quality Gate passed and its Vercel Preview reached READY and returned HTTP 200. This checkpoint is documentation-only and does not change the verified app tree.
Next action: User may manually review the stable Preview. Do not promote `perf/build-size-audit` to `dev` unless explicitly requested.
Blockers: None.

## User prompt

Branch from latest `dev` into `perf/build-size-audit`; comprehensively measure production bundle/chunk/module/static-closure/PWA precache size, identify reachable dead code, unused dependencies, and safe lazy-loading opportunities, then purge/optimize only measured wins. Preserve product behavior and offline capability. Improve the build-size guard with initial/Home closure gzip budgets if justified, update stale §24.14 documentation, and finish with the canonical Quality Gate plus Preview verification.

## Results

- Baseline `dev` SHA: `10bbf772`.
- Stable implementation SHA: `378f5f4274b68c16c1260646d83c25ce5803ac6c`.
- Stable Preview: `https://mosaic-life-tracker-hann8c4nf-carls-projects-72516fde.vercel.app/`.
- Baseline production graph:
  - entry: 540,958 B raw / 163,476 B gzip
  - initial closure: 593,650 B raw / 176,736 B gzip
  - Home closure: 1,265,306 B raw / 391,358 B gzip
  - aggregate app assets: 2,194,495 B raw / 665,971 B gzip
  - unique PWA precache: 2,267,339 B
- Reviewed optimized audit baseline:
  - entry: 423,122 B raw / 125,240 B gzip
  - initial closure: 472,803 B raw / 136,883 B gzip
  - Home closure: 1,114,771 B raw / 339,955 B gzip
  - aggregate app assets: 2,195,734 B raw / 667,418 B gzip
  - unique PWA precache: 2,269,326 B
- Stable canonical build at `378f5f42`:
  - entry: 423,122 B raw / 125,240 B gzip
  - initial closure: 136,879 B gzip
  - Home closure: 339,951 B gzip
  - aggregate app assets: 2,195,682 B raw / 667,415 B gzip
  - unique PWA precache: 2,269,274 B
- Shared eager `Button` no longer imports Framer Motion; the 0.95 press state is CSS.
- Home search no longer pulls Framer Motion into the Home static graph; its entrance animation is preserved in CSS with reduced-motion handling.
- Friend-carousel settings, category management, and the Home hamburger sheet are deferred until first use.
- `repomix` and `vite-plugin-pwa` are classified as development dependencies; lockfile ownership was refreshed. Production dependency audit is green, and `braces` / `serialize-javascript` are dev-only.
- `scripts/audit-bundle.mjs` now reports source reachability and declared-production-dependency attribution in addition to per-chunk package/module data, closure sizes, deferred-package leak checks, and precache data.
- Vite emits `.vite/manifest.json` for the build-size graph check; Workbox excludes it from precache.
- Build-size guard now protects seven metrics, including initial-closure and Home-closure gzip budgets. Home closure ceiling is 357,000 B gzip; prior aggregate/precache ceilings were not raised.
- Purged six unreachable legacy source files with no live consumer: `TopBar.tsx`, `EditTaskSheet.tsx`, `AppearanceSettingsSheet.tsx`, `useImageCompression.ts`, `mockData.ts`, and `TestPlayground.tsx`. These deletions are source cleanup, not claimed as emitted-byte savings.
- `useDiary.ts` and `useFeatureFlag.ts` remain because they retain dedicated tests/contracts despite not currently being route-reachable.
- `react-router-dom` appears absent from package attribution because its emitted implementation is attributed to `react-router`; it is actively imported throughout the app and is not unused.

## Verification

- Task-branch final candidate `cbb02cb8`: full canonical Quality Gate passed.
- Stable `perf/build-size-audit` implementation `378f5f42`: checks, dependency audit, both DOM shards, build, both browser-contract shards, and canonical acceptance all passed.
- Stable Vercel Preview for `378f5f42`: READY; root fetch returned HTTP 200.
- No manual device/browser acceptance was claimed.
