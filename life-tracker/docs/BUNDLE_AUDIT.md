# Phase 3.1 — production bundle audit

Measured 2026-09-19 against `2a07ea6` (`docs: migrate workflow to Codex`).
This batch adds measurements and recommendations; runtime code, dependencies, and
build configuration are unchanged.

Follow-up (2026-09-19): the service-worker activation prerequisite below has since
been fixed using passive `prompt` registration. Production builds now enforce the
generated policy; see [project reference §24.9](PROJECT_REFERENCE.md#249-generated-service-worker-policy)
for checks and browser results. The measurements and original findings below remain
the historical Phase 3.1 baseline.

## Reproduce

From `life-tracker/`, with the lockfile dependencies installed:

```bash
npm run build
node scripts/audit-bundle.mjs
```

The first command type-checks and builds the normal production output. The second
uses the same Vite configuration, adds an observational bundler plugin, and writes
artifacts and `report.json` to a unique `mosaic-bundle-audit-*` OS temporary directory.
It prints that path, emitted sizes, package attribution, and service-worker flags.
It does not replace `dist/`. The JSON includes the module graph for import tracing.
The service-worker inspector executes generated wiring with Workbox stubs, separating
immediate activation from an explicit message handler; revisit it after plugin
upgrades. Temporary reports are local diagnostics, not
tracked artifacts or a CI size budget.

Measured environment: Node 22.22.2, npm 10.9.7, Vite 8.3.0, Rolldown 1.2.8,
vite-plugin-pwa 1.3.0. Both builds succeeded. Every emitted file from the diagnostic
build was byte-identical to its normal-build counterpart.

## Baseline

Sizes below are exact bytes. Gzip uses Node's `gzipSync` defaults, consistently
across files; deployed server compression may differ. Vite's own reporter displays
501.70 kB gzip for the main chunk under its compression settings.

| Artifact | Raw bytes | Gzip bytes | Loading |
|---|---:|---:|---|
| `assets/index-Bv-U2pe2.js` | 1,718,857 | 497,244 | Eager app entry |
| `assets/index-DsMG3yLl.css` | 34,965 | 7,689 | Eager stylesheet |
| `assets/photoswipe.esm-DelnInxx.js` | 58,836 | 16,923 | Dynamic viewer core; also precached |
| `workbox-9c191d2f.js` | 15,112 | 5,192 | Service-worker runtime |
| `sw.js` | 1,728 | 923 | Service worker |
| `index.html` | 1,162 | 546 | Document |

- Entry JS + CSS: **1,753,822 raw / 504,933 gzip bytes**.
- All app JS chunks + CSS: **1,812,658 raw / 521,856 gzip bytes**.
- These totals exclude HTML, icons, registration, manifest, and SW runtime. They
  describe emitted artifacts, not measured navigation transfers or startup time.
- The build warns that the main chunk exceeds 500 kB. Keep the warning visible.
- All nine page components in `src/App.tsx` are statically imported. PhotoSwipe's
  viewer core is the only application dynamic chunk today.

The generated precache manifest contains **14 entries / 11 unique URLs**, covering
**1,873,073 raw bytes** once per unique URL. Apple-touch and PWA icons appear more
than once; repeated entries do not establish repeated network transfers. Both JS
chunks are precached. No user images, Appwrite responses, or database contents appear
in this manifest.

## Phase 3.2 result (2026-09-19)

Phase 3.2 implemented every page as a lazy route while keeping `AppLayout`, auth,
database boot, and shared providers eager. It also deferred the emoji picker, image
compression, export ZIP implementation, and PhotoSwipe lightbox until their actions
request them. The same diagnostic script produced these post-change measurements:

| Static closure | Raw bytes | Gzip bytes | Change from baseline entry JS + CSS |
|---|---:|---:|---:|
| Initial app shell | 994,995 | 300,428 | −43.3% raw / −40.5% gzip |
| Initial shell + first Home route | 1,226,291 | 375,782 | −30.1% raw / −25.6% gzip |

The closures include their statically imported JS chunks and applicable base/route
CSS. They are bundler-graph artifact totals, not observed network transfers or startup
time. The initial route also depends on whether auth sends the user to Login or Home;
the Home row is the conservative authenticated startup comparison.

All app JS/CSS assets together are 1,827,396 raw / 543,120 gzip bytes across 48
files, compared with 1,812,658 / 521,856 across three baseline files. Splitting adds
14,738 raw bytes and gzip-per-file overhead while substantially reducing startup
closures. The unique precache payload rose by 14,884 raw bytes (0.8%) to 1,887,957;
offline installation still downloads every app chunk by policy.

Verified optional chunks and Node-gzip sizes:

| Boundary | Gzip bytes | In initial or Home static closure? |
|---|---:|---|
| Emoji picker | 88,059 | No |
| Image compressor | 19,746 | No |
| PhotoSwipe lightbox | 4,964 + 1,400 CSS | No |
| PhotoSwipe viewer core | 16,923 | No |
| Export ZIP (`fflate`) | 5,367 | No |

The main emitted entry remains above Vite's 500 kB raw warning because database,
auth/sync, React, routing, and shared layout startup stay eager by architectural
contract. The warning remains enabled. Arbitrary vendor grouping was not added.

An isolated two-release Chromium test served version B after removing all version A
origin assets. While B waited, an open A client loaded every route offline from A's
precache. After A closed, B activated and loaded a split route offline. A separate
test with service workers blocked reproduced a deleted lazy chunk: the route boundary
offered an explicit reload, and that reload recovered to the current deployment and
requested route. This establishes app/SW behavior under a static-host replacement
simulation; verify the real host's HTML cache headers and deployment retention on its
first Phase 3.2 deployment.

## Phase 3.3 result (2026-09-19)

Image acquisition now waits until a task thumbnail or avatar enters a 200px
`IntersectionObserver` preload margin. Selected headers and explicitly opened viewers
remain eager. The gate latches after first enablement, so scrolling away and back does
not release and reacquire the hook while its component remains mounted. Browsers without
`IntersectionObserver` retain eager behavior. Native `loading="lazy"` and async decoding
supplement the upstream gate.

`useTaskImage` accepts an enable flag before it calls `getLocalImageUrl`, while retaining
the shared promise, reference count, and delayed object-URL revocation. `DeferredAvatar`
applies that contract across avatar rows. Task calendar blocks and selected-day items use
the same gate directly. Chat and friend-calendar headers that previously passed storage
IDs directly to `<img>` now use the guarded cache path.

An isolated Chromium harness used the real hook and IndexedDB cache with one eager header
and 20 scroll rows. Initial render read only `header`, `row-0`, and `row-1`; scrolling to
the end added only `row-18` and `row-19`; returning to the top added no reads. Component
tests separately confirm that a gated uncached item does not call `getLocalImageUrl` until
intersection and that simultaneous consumers still share one acquisition. No live
Appwrite image request, mobile/Safari run, or long-list field trace is claimed.

The gate adds a small runtime cost. Compared with the Phase 3.2 artifact snapshot, the
initial static closure is 995,103 raw / 300,447 gzip bytes (+108 / +19), and initial plus
Home is 1,228,088 / 376,472 (+1,797 / +690). All app JS/CSS is 1,829,031 raw /
543,748 gzip across 49 files; the unique precache payload is 1,889,592 raw bytes. The
four optional dependency exclusions still pass. Phase 3.4 owns cache eviction and byte
budgeting; Phase 3.3 does not change persistent cache retention.

## What contributes to the eager chunk

The following values sum the bundler's `renderedLength` by package. They rank
retained module code before final output compression; they are **not final chunk
bytes, transfer sizes, or predicted savings**, and must not be added to the table above.

| Package/group | Rendered length | Interpretation |
|---|---:|---|
| `emoji-picker-react` | 562,793 | Largest optional dependency; defer until a picker opens |
| `react-dom` | 536,767 | Core rendering runtime |
| Application modules | 421,300 | All pages and their dependencies currently eager |
| `rxdb` | 234,640 | Database boot, collections, migrations |
| `motion-dom` + `framer-motion` | 282,534 | Used throughout shared UI |
| `ajv` | 184,141 | Database schema validation |
| `swiper` | 147,870 | Home person carousel and day view |
| `appwrite` | 143,402 | Auth, storage, sync, social services |
| `dexie` | 132,332 | Persistent local database storage |
| `react-router` | 93,186 | Routing |
| `browser-image-compression` | 81,748 | Optional upload work pulled into image reads |
| `rxjs` | 58,925 | Database/reactive infrastructure |
| `embla-carousel` | 43,112 | Calendar carousels; distinct from Swiper's usage |
| `photoswipe` lightbox portion | 24,608 | Core already split; wrapper remains eager |
| `fflate` | 19,248 | Optional data export |

RxDB dev-mode modules are absent from emitted module metadata. The development-only
plugin registration is not an established production-size problem. Do not remove
database validation, migrations, offline initialization, or a carousel library based
only on this ranking.

## Opportunities and implementation boundaries

### 1. Split routes, then check what Home still imports — Phase 3.2

Start with page boundaries in [App.tsx](../src/App.tsx), keeping the shared layout,
auth ownership, and `FriendsProvider` → `ConversationsProvider` order intact. Pages
use named exports, so a `React.lazy` adapter must supply a default export. Keep a
local Suspense loading state and the existing route/root error boundaries; import
failures need a recoverable path rather than an endless spinner.

Measure the eager entry **and its static dependency closure**, plus first Home and
first login navigation, after splitting. A smaller entry file alone does not prove
less initial code. Optional pages can move out of that closure, while Home's own
dependencies still load when Home opens.

The largest optional dependencies require additional interaction boundaries. Treat
these as proposed scope to agree when defining the implementation batch:

| Candidate | Verified eager import path | Suggested boundary |
|---|---|---|
| Emoji picker | `HomePage → PersonPane → CalendarBody → FriendDayViewSheet → EmojiPickerSheet`; also `ChatPage → EmojiPickerSheet` | Load picker implementation only when opened, inside the existing BottomSheet flow |
| Image compression | `HomePage → PersonCarousel → useTaskImage → storage → browser-image-compression` | Import compressor when compression is requested; preserve the shared image-read path |
| Export | `SettingsPage → ExportDataSheet → exportData → fflate` | Route splitting defers it from Home; demand-load export for finer savings if justified |
| PhotoSwipe lightbox | `DayViewSheet → ImageViewer → photoswipe/lightbox` | Optional further viewer boundary; lower priority because core is already dynamic |

`lazyLoadEmojis` controls emoji image loading, not loading the picker library.
Returning no sheet children while closed also does not defer a static import.
`useImageCompression.ts` has another static compressor import, but it is absent from
the emitted graph today; it is not a second measured cost. Account for it if reused.

### 2. Keep vendor splitting evidence-driven — Phase 3.2 / 3.6

Database initialization is awaited before rendering in `main.tsx`, including on
login. Moving RxDB, Dexie, AJV, Appwrite, or React into named vendor files does not
remove the startup dependency. Vendor grouping can improve cache reuse across
deployments, but may also couple unrelated features and add eager requests.

Establish route/interaction boundaries first. If manual grouping remains useful,
use the installed Vite 8 / Rolldown configuration and inspect the resulting graph;
do not paste an older Rollup `manualChunks` recipe or group all dependencies into
one vendor chunk. Record both cold-load and warm-cache behavior before choosing a
Phase 3.6 budget. Do not raise the warning threshold to claim improvement.

### 3. Defer actual image acquisition — Phase 3.3 / 3.4

Avatar and task images use [useTaskImage.ts](../src/hooks/useTaskImage.ts). Its effect
acquires cached blobs or starts a storage fetch when mounted, before an `<img>`
receives its blob URL. Adding `loading="lazy"` alone therefore does not prevent
those upstream requests.

Gate acquisition by visibility where useful, preserving placeholders, existing
calendar windowing, shared requests, cancellation, blob-URL reference counts and
delayed revocation. Avoid delaying visible avatars or selected-day content. Native
lazy loading/async decoding can supplement that work. Measure actual requests and
scroll behavior. Phase 3.4 added the separate persistent 50 MiB LRU byte budget.

Static icons are much smaller than the JS entry (largest PNG: 25,877 raw bytes).
Icon compression and duplicate manifest cleanup are lower priority than optional
code loading. There are no emitted font files in this baseline.

### 4. Resolve the service-worker activation mismatch before releasing splits

[vite.config.ts](../vite.config.ts) says `autoUpdate` is retained while
`skipWaiting: false` and `clientsClaim: false` prevent mid-session takeover. The
**generated worker contradicts that intent**: it calls both `self.skipWaiting()` and
`clientsClaim()`.

In installed `vite-plugin-pwa/dist/index.js`, option resolution forces both flags
to `true` when automatic registration and `registerType: 'autoUpdate'` are combined.
The plugin's [automatic-update documentation](https://vite-pwa-org.netlify.app/guide/auto-update)
confirms that override. The PWA-4 comments in `vite.config.ts` describe intent,
not the current emitted behavior; the discrepancy is now recorded in the project
reference's service-worker notes.

This is a confirmed configuration mismatch, **not a reproduced data-loss or page
reload incident**. With more lazy chunks, an older open page requesting an older
chunk after deployment needs explicit compatibility handling. Agree on controlled
activation, old-asset availability, and chunk-load recovery before deploying splits.
Recommend bringing this narrow part of Phase 3.5 forward as a release prerequisite;
the broader update-prompt/install/share features remain separate. No activation
policy or roadmap implementation order is changed by this audit.

The current precache glob includes every generated JS/CSS file, including dynamic
chunks. Route splitting can reduce synchronous loading/evaluation, but it does
**not** by itself reduce the full PWA installation payload. Do not exclude lazy
chunks just to improve download figures: that would need an explicit offline-route
policy and regression checks. Keep user-generated data/images owned by RxDB and
the image cache, outside SW precache.

## Verification and next-batch acceptance

Audit verification: production build passed; diagnostic build passed with identical
artifacts; script syntax check and repository lint passed; local document links,
roadmap consistency, and `git diff --check` passed. No runtime files changed. The
runtime test suite was not rerun for this measurement/documentation batch.

No browser performance profile, Lighthouse score, real network transfer, heap
measurement, or deployment-update reproduction was performed. Savings remain
hypotheses until the implementation is measured.

For the next implementation batch, require lint → test → build and:

1. Compare the same artifact metrics and graph with this baseline; verify unopened
   picker/compressor/export code is actually outside the relevant eager closure.
2. Exercise direct links, login/logout and account switches, all routes, picker,
   upload and export. Keep loading, errors, sheet focus and keyboard behavior usable.
3. Install online, go offline, relaunch into Home and a nested messages route, then
   visit a route not opened before going offline. Verify cached identity and data.
4. Test a deployment with an older tab open, delayed/failed lazy imports, and active
   offline/sync work. Verify the agreed update policy and recovery without losing
   unsaved work. A blind automatic reload is not a sufficient recovery policy.

## Phase 3.6 result (2026-09-20)

Every `npm run build` now checks `config/build-size-budget.json` after the production and
service-worker policy checks. The guard measures the module entry named by `index.html`,
all emitted `assets/*.js` and `assets/*.css`, and the unique files named by the generated
service-worker precache. Raw and Node-gzip entry/aggregate sizes catch both startup-shell
and deferred-code growth; unique raw precache size catches offline-install growth.

The reviewed baseline at `6fa2014` and limits are:

| Metric | Baseline bytes | Limit bytes | Headroom |
|---|---:|---:|---:|
| Entry JavaScript raw | 856,191 | 900,000 | 5.1% |
| Entry JavaScript gzip | 265,231 | 280,000 | 5.6% |
| All app JavaScript/CSS raw | 1,842,369 | 1,935,000 | 5.0% |
| All app JavaScript/CSS gzip | 548,796 | 577,000 | 5.1% |
| Unique precache payload raw | 1,902,776 | 2,000,000 | 5.1% |

The guard uses exact bytes rather than hashed filenames or Vite's formatted reporter.
It is a regression threshold, not a performance target and not evidence that a build is
fast. It does not measure network protocol compression, runtime evaluation, cache reuse,
Lighthouse, or a particular route's full static dependency closure. Continue using
`scripts/audit-bundle.mjs` for graph and closure investigations.

Do not raise a limit merely to turn a failed build green. First inspect the emitted graph
and explain the intended product/dependency change. If the growth is accepted, rebuild
the production assets, update both the measured baseline and the affected limit in the
budget file, retain deliberate headroom, and record the decision here. The
`npm run build:size` command rechecks an existing `dist/` and prints every actual/limit pair.

Phases 3.2–3.6 and the activation prerequisite are complete. Phase 3.7 PostHog foundation
is next.

## Technical sources

- [React lazy](https://react.dev/reference/react/lazy): Suspense, default-export
  contract, and rejected imports reaching error boundaries.
- [Vite production builds](https://vite.dev/guide/build.html): Rolldown chunk
  configuration and missing chunks after deployment (`vite:preloadError`).
- [PWA static asset handling](https://vite-pwa-org.netlify.app/guide/static-assets):
  generated asset globs and automatic manifest-icon inclusion.
- [Rolldown output metadata](https://rolldown.rs/reference/Interface.OutputChunk):
  emitted chunk and module attribution fields.

### 2026-09-20 Phase 3.7 PostHog bundle repair

The first Phase 3.7 production build exposed a runtime-SDK regression that the Phase 3.6
guard correctly rejected. The full PostHog browser import produced an approximately 288 kB
raw dynamic chunk and pushed aggregate app assets to 2,133,464 B raw / 644,514 B gzip and
unique precache to 2,193,871 B. A slim-browser-SDK experiment still exceeded the locked
budget, so the limits were not changed.

Mosaic now keeps the build-time PostHog source-map plugin but implements the narrow runtime
Phase 3.7 contract directly in `src/lib/posthog.ts`: remote flags use `/flags/?v=2` and
exceptions use `/i/v0/e/` with PostHog's standard exception-list/raw-frame shape. GitHub
Actions run 35522367810 then passed the existing guard without a budget update:

| Metric | Phase 3.7 verified | Existing limit |
|---|---:|---:|
| Entry raw | 859,609 B | 900,000 B |
| Entry gzip | 266,572 B | 280,000 B |
| Aggregate app assets raw | 1,847,510 B | 1,935,000 B |
| Aggregate app assets gzip | 550,524 B | 577,000 B |
| Unique precache | 1,907,917 B | 2,000,000 B |

This keeps Phase 3.6's regression ceilings intact while adding the Phase 3.7 capabilities.
Live PostHog ingestion, flags, privacy settings, and source-map symbolication remain staging
checks rather than build-size evidence.
