# PWA update benchmark — #1674

## Scope and safety

v0.80.1 adds Preview-only Settings → About → Update timing diagnostics (Preview).
Events stay on the current browser (24 recent checks, up to 7 days), and can
be copied or cleared. No automatic upload, identity, task data, URLs or browser
fingerprints are recorded. Do not mistake uncompressed precache asset sizes for
compressed transfer bytes or elapsed installation for actual network throughput.

Do not map any test alias to dev/main/Production. Use only an isolated stable
Preview hostname. For sign-in, Scratch Appwrite must register this hostname
as a Web platform before login will work; do not use Production credentials.

## Prerequisites

- Exact SHA canonical Quality Gate and Vercel READY for test build A and B.
- A **stable same-origin Preview** URL; immutable deployment hostnames cannot
  upgrade an installed PWA from A to B across distinct origins.
- Install **v0.80.1 or newer as A** to ensure timing diagnostics exist before
  update B. Older v0.80.0 cannot record a complete update-to-v0.80.1 trace.
- Two disposable browser profiles on comparable networks/device settings.
  Export history before clearing origin storage or uninstalling an app.
- A real incremental A → B update. An up-to-date check measures discovery
  only, not an update download.

## Repeated manual test

1. Open and install A from the dedicated stable hostname. Confirm the About
   page shows Preview and A, clear timing history, then leave the app online.
2. After A is installed on both test profiles, change **only** the designated
   test hostname to serve reviewed B. Do not alter any shared app URL.
3. Profile 1: select Check for Updates immediately and leave the app visible
   until Ready, an error, or timeout. Expand the timing panel and copy JSON.
   Approve Update now only after recording the timings.
4. Profile 2: leave Mosaic visible and online; do not manually check. The
   scheduled check starts at least ~65 seconds after bootstrap and repeats
   no more than about hourly, and skips hidden/offline pages. Record
   background/browser trace events when found. A check that starts visibly
   is *not* proof of transfer in a hidden tab.
5. Hidden trial: use a fresh A profile; after update discovery starts,
   minimize app or lock screen for a controlled interval (e.g. 30 seconds),
   then reopen and export timing JSON with the visibility events.
6. Join trial: while an automatic update is installing, press Check for
   Updates. Confirm the separate manual trace includes joined-install,
   without initiating a second download.
7. Interruption: with disposable test data, disable network during a download,
   restore it, check recovery and preserve offline Home/nested-route access.
   Check that only Update now activates the waiting worker.

Repeat at least five matched A→B trials per scenario. Alternating order
reduces warming/time-of-day bias; returning to A may require an authorized
test-alias switch and resetting the disposable test profile. Keep A/B asset
payload, cache state, browser, network and battery settings as comparable as
possible and note any deviations.

Compare medians and spread for per-trace elapsed check/found/first-asset/
assets-complete/ready events, separated into manual, automatic-visible and
automatic-hidden runs. Joined traces are not independent downloads. Record
device/browser/network outside the exported JSON without account information.
Differences in these stages are **not** direct measurements of transfer bitrate.

Owner-installed Android/desktop acceptance and matched timing data remain
necessary before claiming a speed improvement or approving promotion to dev.
