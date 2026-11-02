# PWA update benchmark — #1674

## Scope and safety

v0.80.1 and later provide Preview-only Settings → About → Update timing diagnostics (Preview).
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

## First observed trace and v0.80.2 run

One owner's v0.80.1 trace from 2026-11-02T14:23:14Z reported an
approximately 50.341-second browser-initiated install for 213 precache assets,
including a period when the document was hidden. Two near-identical browser
records had identical start times and milestone values; they are not two
independent samples. Two manual check results (109ms, 117ms) and one automatic
check (136ms) reported up-to-date, not downloads, so no foreground/background
speed comparison is established. v0.80.2 guards repeated browser callbacks for
the same installing worker and can provide the next A→B test payload.

Before measuring A→B, **A must already be present and installed on the same
test origin**. Keep A open at least once after installing. Switching the
dedicated alias to B first and then installing B is not an A→B measurement.

## Second observed trace and v0.80.3 attribution correction

A second owner timing export from 2026-11-02T15:08:31.907Z reports a
manual foreground check reaching Ready in 2.572s (213 precache assets).
A second browser record started 0.721s after the manual check and showed
identical asset-progress milestones, shifted by that same offset. They are
the same underlying worker installation, not two independent runs.
A previous partly-hidden browser installation took 50.341s. The 19.6-fold
observed timing difference is not a controlled demonstration that a hidden
tab is slower; cache, payload, network and browser scheduling remain
unmeasured. Two earlier manual checks ended in error at 0.263s and 0.181s;
their exception causes were not captured by v0.80.1.

v0.80.3 corrects diagnostic classification while an app-initiated manual or
background check is still in progress even if registration.update() has
resolved, removes duplicate manual found/downloading stage labels, and
captures only a fixed category for later update-check errors. No
exception message, user content or URL is stored. A manual trace and
automatic trace that join the same installation should not be counted as
independent downloads even if both show progress.

Manual owner acceptance requires a v0.80.2 installation opened and kept
on the existing dedicated hostname before the v0.80.3 alias change. No
network throughput comparison or speed gain is established by this
diagnostic-only correction.

## Third observed trace and update prompt version labeling

Owner's 2026-11-02T16:10:01.067Z background trace reached ready after
3,458 ms for 213 precache assets (first asset 894 ms, all assets 3,456 ms).
A browser-labeled trace starts 790 ms later and has the same corresponding
asset totals/stages: this is one installation recorded twice, not a second
download. The recording client had not necessarily activated v0.80.3 yet;
do not treat this as proof that v0.80.3 already fixed the duplicate labels.
The old 50,341 ms partly-hidden trial and this foreground-started 3,458 ms
trial are uncontrolled, not a verified throughput or hidden-tab comparison.

The next Preview candidate v0.80.4 adds the waiting worker's version to the
update-ready prompt. The **installed app** version and **target waiting worker**
version must be distinguished. The waiting worker answers an explicit local
message with its bundled source-of-truth version; the client trusts only a
valid reply from that exact waiting worker. Older waiting workers may not
support the request, in which case the existing generic prompt remains.
No endpoint fetch, automatic activation or additional precache is required.
Verify both version-known and version-unknown paths during A→B testing.
