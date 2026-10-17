# Calendar critical-path audit (#858)

Purpose: attribute the cold cached Home timeline before proposing changes to the stable v0.29.7 Preview. This isolated branch uses the original local owner task/category code; it does not remove security providers, force pre-auth queries, or alter user-visible rendering. The only changes are a read-only browser test and workflow.

Invariants: AuthProvider alone supplies cached owner; every RxDB query uses that owner, route shell protects database initialization, existing sync and PWA behavior remain. No account credentials, Production backend use, deployment, alias or release.

Protocol: Chromium 412 × 915, 2× CPU throttling, cached service-worker, 0/25/1000 text tasks created by real UI into a disposable IndexedDB fixture. Compare slow-online Appwrite-held and fully offline runs, n=3. Time origin is document navigation. Collect all existing `mosaic:*` performance marks, resource durations, long-task summary, first task DOM visibility. A mark observed in a React effect is not identical to first paint or first usability; resource durations are not CPU attribution. Cross-run absolute times cannot be compared without calibration.

Structural questions: Why does Home mount ~330ms after DB is ready? Is the remaining delay dynamic module evaluation, full provider tree, route/render work, or scheduling? Measure existing `auth:resolved`, `app-shell:module-ready`, `app-data-shell:mounted`, `home:mounted` first. Distinguish task query `home:mounted→home:tasks-ready` from the earlier mount wait. Record proper 0-task control; no new hard performance budgets. Analyze results in #858 before any runtime change. Preserve v0.29.7 Preview and forbid dev/main/Production promotion without owner approval.
