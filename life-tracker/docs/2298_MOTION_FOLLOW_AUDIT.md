# #2298 motion-follow diagnostic checkpoint (2026-11-25)

Owner supplied five numeric real-device rAF samples: panel diary-note 252 frames,
p95 4.4ms, max 12.5ms; panel category 138 frames, p95 4.3ms, max 5.1ms;
neither had >32ms intervals or LoAF/longtasks. Sheet diary notes: 270 frames
p95 4.3ms/max 8.4ms and 163 frames p95 12.2ms/max 20.8ms.
Sheet category measured only 2 frames, one 62.5ms. No task drag was recorded.
Owner still reports severe side-panel lag and visual frame drops.

rAF cadence is not a measurement of actual presented frames nor
pointer-to-overlay tracking. No causal root is established by these data.

Opt-in `?mosaic2298Perf=1` adds numeric *relative* movement discrepancy
between the pointer and the task/category/Diary overlay sampled at ~15Hz,
plus estimated pointer event dispatch delay. It retains existing rAF/LoAF
metrics. This is not a performance fix. Exports only distances/counts/
durations and coarse gesture/presentation, never raw pointer coordinates,
task IDs/titles, diary content, account information or network telemetry.
`visualTracked=false` means overlay not found, not smoothness.
Regular default app has no recorder/UI change.

For decisive owner A/B use the same day in side-panel and bottom-sheet
and drag a **task** as well as category pill and Diary note while holding
the pointer in motion. Paste Copy summary JSON. Interpret tracking
metrics cautiously: DOM geometry read ~15Hz may add measurement overhead
and compositor visuals can differ from DOM geometry.
All changes remain diagnostic-only on isolated task branch, based on
the unchanged stable feature v0.130.10. Require exact CI/Preview gates.
