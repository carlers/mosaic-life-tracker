# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 structural Calendar/Todo query, rendering and parallel-read scaling diagnostic; research only.

## Accepted boundary
- Baseline dev v0.29.8: `bfb0fff0c1c283f599f32db8c2a426416fa65e7b`. #858 stays OPEN. Do not promote this experimental source branch to stable Preview, dev, main, Production, or 1.0.
- User approved a structural zoom-out focusing on parallelization and efficient task loading/rendering with increasing cached task counts, rather than marginal CSS containment.
- New branch `chatgpt/858-structural-scaling-lab-20261018` forks dev. No backend/remote data, production accounts or real credentials.

## Read-only experiment
- One diagnostic-only HomePage `useEffect` conditionally loads `src/lib/issue858ScalingLab.ts` **only** when the CI-only build flag and sessionStorage synthetic fixture flag are both set. The bridge rejects any cached owner other than `issue858_scale_user`; measured PWA launches do NOT set this flag or import the module. The bridge uses real RxDB `bulkInsert` for synthetic task documents and only reads while comparing global owner-scoped sorted tasks, month-window queries, and three month queries serial vs `Promise.all`.
- Disposable Playwright `startup-structural-scaling.spec.mjs` creates a real UI category and persists IndexedDB snapshots at task counts 0/25/250/1000 on one day, plus 250/1000 across current month and 1000 across five years. Captures six warm, order-balanced read timings per populated fixture; tests current-month cardinality equality. Per fixture, run both default Calendar and Todo, 2× CPU, cached assets, offline vs throttled-online, three repeats (84 launched browser samples).
- Measure DB→Home, DB→first RxDB task result, task result→Home, FCP, two-frame proxy, DOM count, long tasks and first synthetic action response. Full owner data remains loaded by existing production useTasks code. Interleaved test conditions minimize order bias; experiments cannot establish significance or real-phone paint.
- Auth and Appwrite held/blocked in diagnostic. No app feature changes are proposed from this branch. Never ship `issue858ScalingLab.ts` or the HomePage diagnostic import.

## Next
- Confirm exact Actions run and strict compile/build checks; repair any audit-specific failure without modifying production behavior. Analyze matched mode/view/task-distribution p50/p90, query concurrency and query/cardinality, not inter-run absolute speeds. Decide whether date-scoped loading, parallel subscriptions, preloading ahead of Home, or dense render/window changes are worth a separate product candidate, with regressions protecting account isolation, swipe/reorder/Diary/shared and accessibility.
- Subsequent runtime changes require focused and canonical Scratch Preview gates, browser and device acceptance and explicit dev/main promotion. #936 security and #914 backend rollout remain separate 1.0 gates.
