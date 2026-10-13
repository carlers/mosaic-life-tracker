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
  benchmark requires the app's existing \`mosaic:home:local-data-ready\` mark
  and separately records database, Home mount and other available startup marks.
  **This is not authenticated Scratch Home**, not a device with a populated
  RxDB, and not an installed offline PWA opening from its launcher.

The audit also reads all seven historical byte measurements from the **same
already emitted dist/**, plus deferred assets and largest logical chunks.
Measurements are written outside \`dist/\` so they cannot enter the
service-worker precache or Vercel deployment output. There are **no new
arbitrary wall-clock or byte-size pass/fail limits**; errors / missing readiness
marks fail the audit as invalid data, not as performance regressions.

## Run locally (without Vercel)

From \`life-tracker/\`:

\`\`\`bash
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
\`\`\`

The new test is tagged `@mobile-audit`; ordinary canonical browser tests
exclude `@performance`, and the existing `test:performance` command selects
its original diagnostic file only. This avoids accidental mandatory CI delay.

The command starts/stops a local \`vite preview\` server on port 4179.
Reports: \`.mosaic/mobile-startup/{mobile-startup,size-snapshot}.json\`.

If the **existing** seven-ceiling guard rejects a feature that is still
structurally valid, do not change the ceiling for this diagnostic. To isolate
the lab build, run the same TypeScript/Vite/precaching/PWA/fingerprint steps
as the nonblocking GitHub diagnostic workflow; mandatory canonical acceptance
still enforces all seven existing ceilings.

## GitHub automation and safety

The dedicated \`mobile-startup-audit.yml\` workflow runs only on the
temporary #784 task branch during its pilot and, **once separately accepted
on the default branch**, on a weekly main-owned schedule or manual dispatch.
Scheduled/manual runs explicitly check out the current \`dev\` branch;
the workflow records its exact source SHA. It uses read-only permissions,
no Vercel token or deployment, no provider write secrets, no real accounts,
and blocks all Appwrite HTTP requests inside the browser. It emits JSON
artifacts on success *and* sample/readiness failures. GitHub cron schedules
are best-effort, not strict SLAs.

The special task-branch push trigger exists solely to allow the initial
no-Vercel CI pilot. Remove it as part of the accepted production audit
workflow cleanup. This workflow is diagnostic and should not be inserted
as another mandatory browser shard in the Quality Gate.

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
