# Session checkpoint

Updated: 2026-10-01
Current task: Repair the post-drop lifecycle for cross-category Day View task reordering.
Status: Implementation complete on `chatgpt/fix-task-reorder-lifecycle`; canonical verification and stable Preview delivery are the remaining automated steps. Real Samsung/PWA acceptance remains required.
Next action: Run exact-SHA full Quality Gate, merge into `feature/task-reorder-clean`, verify the stable Vercel Preview, then repeat the consecutive-drag device protocol.
Blockers: None.

## Root cause addressed
- The cross-category implementation let dnd-kit's OptimisticSortingPlugin reparent sortable DOM nodes while React simultaneously rendered a new category-to-task placement from `dragover`. Current dnd-kit React 0.5.0 has known cross-container reconciliation failures in this area, including broken subsequent sorting and removeChild/DOM ownership failures.
- Mosaic also retained a stale post-drop pending placement in component state after live RxDB placement converged, allowing old placement to become eligible again after later live changes.
- The prior browser harness stopped after a single drop and did not mutate task documents the way RxDB does, so it never exercised post-persistence reconciliation or a second drag.

## Fix
- Every task `dragover` prevents the OptimisticSortingPlugin update before React applies dnd-kit's grouped `move()` result. React is the only owner of category/task DOM ordering during the active drag; dnd-kit still owns sensors, collision data, pointer feedback, and the projection helper.
- Post-drop placement is an explicit commit generation. It remains the render source only while live RxDB catches up, then is permanently retired when the live placement matches or the task set changes.
- Persistence failure can clear only the matching commit generation, so an older async failure cannot erase a newer drag.
- The browser harness now applies reorder callbacks to task `categoryId`/`order` state and includes a consecutive cross-category drag regression that checks task uniqueness/visibility and second-drag activation without remounting.
- No schema, sync mapping, Appwrite, or remote-service changes are required.
