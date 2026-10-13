# Mobile startup / PWA size audit (#784)

## What this measures

A repeatable **lab approximation**, not a physical phone benchmark:
a production Vite build served locally, Chromium with a 412×915 mobile
viewport, 4× CPU slowdown relative to its CI runner, 150 ms added
request latency and 1.6 Mbps downstream throttling. Each of three runs per
scenario uses a brand-new browser context with service workers blocked, so
cold-document downloads do not accidentally reuse a warmed installed app.

Scenarios:

- **Signed-out login:** first document navigation and visible Login heading.
  Record first contentful paint, optional LCP and the React-mounted mark.
- **Synthetic cached-offline Home:** a disposable *fake* cached account hint
  and navigator offline mode. All Appwrite API requests are blocked. The
  benchmark requires the app's existing `mosaic:home:local-data-ready` mark
  and separately records database, Home mount and other available startup marks.
  **This is not authenticated Scratch Home**, not a device with a populated
  RxDB, and not an installed offline PWA opening from its launcher.

The audit also reads all seven historical byte measurements from the **same
already emitted dist/**, plus deferred assets and largest logical chunks.
Measurements are written outside `dist/` so they cannot enter the
service-worker precache or Vercel deployment output. There are **no new
arbitrary wall-clock or byte-size pass/fail limits**; errors / missing readiness
marks fail the audit as invalid data, not as performance regressions.

## Run locally (without Vercel)

From `life-tracker/`:

```bash
npm ci
npm run test:browser:prepare
./tests/e2e/node_modules/.bin/playwright install chromium

# Controlled isolated Scratch build: never default to the Production Appwrite client.
VERCEL_ENV=preview \
VITE_APPWRITE_PROJECT_ID=6a96e82d000d1310b3be \
VITE_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1 \
VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID=audit-no-backend \
npm run build

npm run size:report
npm run audit:mobile-startup
```

The new test is tagged `@mobile-audit`; ordinary canonical browser tests
exclude `@performance`, and the existing `test:performance` command selects
its original diagnostic file only. This avoids accidental mandatory CI delay.

The command starts/stops a local `vite preview` server on port 4179.
Reports: `.mosaic/mobile-startup/{mobile-startup,size-snapshot}.json`.

If the **existing** seven-ceiling guard rejects a feature that is still
structurally valid, do not change the ceiling for this diagnostic. To isolate
the lab build, run the same TypeScript/Vite/precaching/PWA/fingerprint steps
as the nonblocking GitHub diagnostic workflow; mandatory canonical acceptance
still enforces all seven existing ceilings.

## GitHub automation and safety

The dedicated `mobile-startup-audit.yml` workflow had its one-time no-deploy
pilot on the task branch. Its temporary push trigger is removed. **Once separately
accepted on default `main`**, it runs on Monday/Thursday (GitHub best-effort) or
manual dispatch, checking out `dev` and recording its exact SHA.
Scheduled/manual runs explicitly check out the current `dev` branch;
the workflow records its exact source SHA. It uses read-only permissions,
no Vercel token or deployment, no provider write secrets, no real accounts,
and blocks all Appwrite HTTP requests inside the browser. It emits JSON
artifacts on success *and* sample/readiness failures. GitHub cron schedules
are best-effort, not strict SLAs.

No ordinary task push triggers this workflow. It is an independent advisory
scheduled diagnostic and must not be inserted as a mandatory browser shard in
Quality Gate.

The build uses Scratch client identity with **an intentionally inert Function
placeholder** because the browser test never calls Appwrite. GIPHY is
disabled in this environment; explicitly compare only equivalent build
profiles when joining these results to CI or Vercel size data.

## Interpretations and remaining measurement gaps

- Report p50 / p90 of readiness marks and paint metrics *within the same
  runner/browser/build profile*. Three runs give coarse quantiles and do
  not establish a stable SLA. Track several weeks, compare against source
  SHA, Chrome/Node/runtime versions, and investigate high variance.
- CPU throttling is relative to the runner. Emulated network conditions do
  not reproduce real mobile TLS, carrier packet delay, device thermal load
  or Safari/iOS.
- A cold browser profile *cannot measure offline-installed warm launches*.
  A future isolated protocol should populate a disposable IndexedDB fixture,
  install the service worker, visit once online and measure actual offline
  reopen/update changed-asset download costs without Production credentials.
- Authenticated cold Home performance requires a disposable registered
  Scratch account and seeded nonprivate data. Do not auto-provision a live
  cloud account or use production identities simply to satisfy a benchmark.
- Any decision to make performance or selected size metrics blocking belongs
  to a separate evidence-based #784 policy cutover, coordinated with #592's
  pre-Vercel canonical acceptance. Keep the PWA correctness checks blocking.

Baseline numbers from this diagnostic should be treated as *relative trend
signals*, not an absolute real-phone experience claim. A one-off real-device
calibration is optional and must be labeled separately.

## Initial pilot results (not performance pass/fail thresholds)

Action run [#38424472937](https://github.com/carlers/mosaic-life-tracker/actions/runs/38424472937) passed: one Vite build, PWA completeness, seven-metric report, Chromium mobile test (6/6 samples), artifact upload. No deployment requests, backend calls, or secrets. Scratch client profile and GIPHY disabled.

| Scenario | Three readiness times | p50 readiness | p50 first contentful paint |
| --- | --- | ---: | ---: |
| Signed-out Login | 1231.6, 1220.5, 1226.8 ms | 1226.8 ms | 1360 ms |
| Synthetic cached-offline Home | 4102.9, 4072.6, 4107.4 ms | 4102.9 ms | 1400 ms |

Home's median largest-contentful paint was 4036 ms, close to the Home local-data mark. The ~4.1 second timing is not evidence of *real* Mosaic device slowness; controlled throttling, empty synthetic data, network path, host and service-worker state all differ. This run alone **cannot** justify a new hard startup threshold. For this exact snapshot: entry raw/gzip 446094/132754 B; initial/Home gzip 145990/368678 B; all JS/CSS raw/gzip 2468745/766063 B; PWA precache 2556052 B.

## Paired synthetic eager-import sensitivity experiment

[CI run #38426273139](https://github.com/carlers/mosaic-life-tracker/actions/runs/38426273139)
passed a one-time paired build/test. Its disposable CI checkout forcibly imported
the normally lazy NotificationsPage into the initial graph, compared against
the normal exact source on the *same runner*, then discarded the modification.
Neither variant was deployed, and the eager import is NOT checked into source.

| Size signal (eager minus normal) | Difference |
| --- | ---: |
| Initial closure gzip | **+203,914 B** |
| Home closure gzip | **+52,682 B** |
| Aggregate JS/CSS gzip | −8,104 B |
| Unique PWA precache raw | −9,308 B |
| Entry gzip | −6,766 B |

**Actual Login first paint p50:** normal **1,356 ms**, eager **2,504 ms**
(+1,148 ms); **Home first contentful paint p50:** normal **1,396 ms**,
eager **2,664 ms** (+1,268 ms). Critically, fake offline Home
`local-data-ready` p50 changed from 4,081.6 ms to 4,080.7 ms
(essentially flat): database readiness dominates the latter mark,
so **a single Home-ready stopwatch measurement would have missed the
noticeably delayed first paint**. Report both paint and functional readiness.
These are three-sample, non-blinded lab results on one throttled Chromium runner,
not real-device acceptance or a universal latency law.

Conclusion: aggregate output size can *decrease* while front-door loading
becomes appreciably slower. Preserve static-closure size observability,
keep a meaningful initial/Home tripwire, and track aggregate/PWA offline
footprint as advisory trends pending actual install/update device evidence.
The one-time CI mutation and push trigger are deliberately absent from the
lasting scheduled audit.
