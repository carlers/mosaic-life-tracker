# Opt-in real-device Diary/task drag boundary diagnostic (#2298)

This standalone diagnostic is **not** the performance fix and must not be
squash-merged into the stable Diary feature/dev/main. It mirrors the successful
opt-in scroll diagnostic from #2300 and is used only for owner evidence on a
temporary exact-Git-SHA Preview. Existing Mosaic builds do not load it.

## Owner workflow

1. Open the separately verified temporary diagnostic Preview with
   `/home?mosaicDragProbe=1` in Brave (tab or installed PWA only when the
   correct origin is installed). Open **Me → Todo Day View** with multiple
   populated categories and distributed Diary entries.
2. Tap **Start drag test**, then drag a **category pill**, **task**, **Diary
   entry**, and **grouped Diary card** across several row/category boundaries.
   Use actual sluggish gestures, reversing direction and crossing the same
   boundary multiple times. Move at a normal human pace for 10–30 seconds.
3. Tap **Stop**, then **Copy JSON** and paste the resulting report into the
   same ChatGPT conversation. If the Clipboard API is unavailable, the probe
   selects a read-only JSON textbox for manual copy. Retry a separate recording
   for phone vs laptop; do not mix platforms in one result.
4. The control is local-only and never sends a report. Remove the URL
   parameter or open the regular stable Preview to disable it.

## Data and interpretation

Only the explicitly opted-in session installs listeners and observers; no
task/diary content, account ID, row ID, raw pointer coordinates, cookies, API
tokens, sync payloads, storage values or full browser user-agent strings are
collected. It does not call fetch, sendBeacon, or any reporting endpoint.
It records generic drag kind, count/duration/path length (not coordinates),
frame interval distributions, input event dispatch delay, long tasks,
long-animation-frame durations with coarse JS/layout attribution where
supported, approximate DOM structural reorder bursts and associated slow
frames, viewport dimensions, PWA status and build commit if present. Recording
stops after 45 seconds, on manual Stop/Copy or tab backgrounding.

**Owner recording #1 results (diagnostic v1):** On Windows Brave 1920x917,
a 45.0-second report from the exact v0.130.7 diagnostic Preview captured
4,690 frame intervals: median 7 ms, p95 13.2 ms, p99 **118.1 ms**, maximum
215.3 ms, with 75 intervals exceeding 50 ms. Long Animation Frames repeatedly
showed approximately 115–140 ms of attributed JavaScript execution and a
negligible browser interval after style/layout *start* (not an exact layout
duration). This is measured main-thread JavaScript blocking, **not proof of
which script/function or boundary caused each stall**.

The v1 recorder's `before`/`after` snapshots selected an empty or incorrect
Day View slide (all category/task/note/group counts zero), registered no DOM
structural boundary events, and lost completed Diary note gestures because
the real Diary drag handler captures and stops propagation at **window**
before `document` observes the final input. Consequently, v1's
`nearStructuralBoundaryFrames` (0 samples) and `likelyDrag=false` labels
are invalid for root-cause attribution. The user gestures and lengthy JS
stalls were real observations; don't treat those missing probe events as
proof the UI did not reorder.

**Diagnostic v2 correction (schema 2):** Prefer the visible, populated Day
View slide; rebind the structural observer to the actual gesture's owning
slide on pointerdown; install observer listeners on window capture so Diary
stopPropagation cannot hide pointerup/cancel; classify long tasks and long
animation frames against drag intervals; provide up to three per-frame
privacy-sanitized JavaScript source labels (bundled asset basename, browser
extension, external, unknown), safe function/invoker names and attributed
durations, without exporting full URLs or content. Long Animation Frame
attribution is optional in some browsers and may be incomplete. The extra
visibility is diagnostic only and does not alter task/Diary order.

**Limitations:** DOM child-list changes are a boundary proxy, not exact
algorithmic decision timestamps. A client-side JavaScript observer can itself
affect scheduling. Long Animation Frames are not available on all browsers
and cannot prove individual React component timings. Distinguish measured
performance differences from inferred root causes; if needed, make a second
narrower opt-in probe with verified explicit marks for the relevant code paths.

**Safety and delivery:** Task-only source, no Appwrite writes, database
changes, telemetry connection or Production. Verify test fixture's no-content
report and non-opt-in absence, browser CI, TypeScript/Vite/PWA/size budget,
exact commit and Preview Appwrite project before giving an owner testing URL.
Do not infer an immutable Preview URL from a branch or title.
