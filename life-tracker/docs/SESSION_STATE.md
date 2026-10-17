# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 jointly optimize Calendar and Todo Home first mount (owner approval). Prototype only.

## Boundary

- Accepted stable Scratch Preview v0.29.6: `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4`; dev/main/Production and 1.0 unchanged. No promotion authorization.
- Candidate `chatgpt/858-local-mount-prototype-20261017` derives from accepted stable. Browser synthetic profiling only; Appwrite held, no backend writes, no deploy. Version remains 0.29.6 until justified user-testable Preview candidate.

## Verified upstream facts

- #858 CI #39034283811: 1000 persisted same-day text tasks, Calendar Home-ready 664ms, Todo 2888ms (online, 2x CPU; offline 666/2973), n=3. Calendar observer-only suppression did not improve readiness.
- Distribution CI #39035865412: 500 visible Calendar tasks 827–859ms vs 741ms outside mounted months. App-wide query remains even with no visible tasks.
- Ephemeral ablation CI #39036689557: Todo baseline / disabled DnD p50 2404/1450ms at 500 tasks and 5306/2104ms at 1000. Disabling Motion layout alone had little impact. This broke dragging intentionally and cannot ship.
- Diagnostic branch #902fe7a passed focused #39037189414 and slow startup #39037189437. These do not verify this new candidate.

## Candidate investigation

- Independent **read-only query strategy** diagnostic: `scripts/issue-858-calendar-query-ab.mjs`, `startup-calendar-query-ab.spec.mjs` and `issue-858-calendar-query-ab.yml`. In a throwaway same-bundle variant compare native RxDB sorted owner-task query to identical account-safe unsorted selector + stable in-memory date/createdAt sort. This is a *hypothesis*, not an authorized runtime query change; must measure early 0/25 and 500/1000 Calendar, preserve identity/sort semantics and reject if not clearly better.
- Existing image-hook Calendar A/B and first-gesture after far-scroll Todo browser probe remain in separate CI; do not infer passing until run completion.

## Next action

- Paired Calendar baseline/optimized **same-build, same-runner** A/B is staged at `scripts/issue-858-calendar-ab.mjs`, isolated workflow `issue-858-calendar-paired-ab.yml`, and `startup-calendar-paired-ab.spec.mjs`. Test-mode-only duplicate component code MUST NOT enter shipped runtime; exact upstream TaskBlock extracted from stable SHA. Compare 0/25/500/1000 cached text tasks, interleaved 3 runs each; record Home-ready, first task DOM, task query, image observers, heap and long tasks.
- Combined prototype benchmark #39042117777 SUCCESS (60/60, built PWA, 174 precache assets). Same-run online Calendar 1000 p50 897ms vs Todo 1863ms; offline Calendar 922ms vs Todo 1865ms. At 500: Calendar 788ms vs Todo 1375ms online. Calendar text-only image observer count 1 instead of ~1000, but **runtime speed gain is not yet verified** against the exact baseline in one run. Separate earlier benchmark runners have materially different absolute timings.
- Prototype focused Quality Gate #39042402115 SUCCESS after generated inventory and checkpoint repair. New unit/dom regressions for shared viewport observer and image-only task hooks on `d693b8c`; verify their own focused job #39042702374 before claiming passing.
- Next: inspect paired CI and performance findings, fix tests/implementation if required; then prove first long-press after scrolling, cross-category/Diary/shared cancel, online/offline and Calendar photo rendering. Do not promote until meaningful Calendar improvement and full correctness acceptance. Retain #858 OPEN; physical Android/iOS + authenticated Scratch, 401, high-image data, multi-tab still outstanding. No dev/main/Production or 1.0 permission. Independent #936/#914 remain pre-1.0 gates.
