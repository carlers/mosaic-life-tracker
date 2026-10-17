# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 slow-network pre-Home splash; automated reproduction confirmed and scoped v0.29.6 performance candidate prepared.

## Branches and release boundaries

- Protected `dev@b0c703636c8c6e8d52c6dd3c59ebc0251070ab7e` remains v0.29.5. `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` remains published v0.29.1. No dev/main/1.0 promotion authorized.
- Diagnostic stable `perf/858-startup-diagnostics-20261017@32175b4bb4b515ebb007fbf70624623e386c306e`: canonical #39011580584 SUCCESS, trusted Scratch Preview READY, no code optimization yet.
- Isolated `chatgpt/858-slow-network-lab-20261017` is preparing user-visible patch candidate **v0.29.6** for the same stable Preview branch. Official Preview remains Scratch Appwrite, no backend schema/Function changes. #745 manual chat regression, #936 privacy audit and #914 compatibility gate remain independent.

## Evidence and scoped implementation

- Owner specifically observes long **Mosaic — Opening your local data…** *before* Home. Source has two competing gates: actual local RxDB ready and an AppDataShell lazy module. Appwrite auth verification already runs in background; delayed `account.get()` does not gate cached Home.
- [Cold/slow/warm production-output lab #39012480354](https://github.com/carlers/mosaic-life-tracker/actions/runs/39012480354), Chromium phone emulation, 2x CPU throttle, synthetic cached identity, Appwrite requests kept unresolved: fast Home owner data ready **1.11s**, throttled assets **5.81s**, pre-cached controlling PWA **0.75–0.80s**. Slow DB module download ~2.2s; AppDataShell import/dependencies ~3.6s; RxDB open ~80ms. **Network JS downloads, not remote connection or local database open, dominate the synthetic slow uncached case.**
- [Initial early-shell A/B lab #39012763324](https://github.com/carlers/mosaic-life-tracker/actions/runs/39012763324) SUCCESS using same synthetic scenarios: fast Home 0.73–0.78s, slow 5.61–5.63s, controlled precache repeat 0.57–0.61s. Runners differ and n=2 per condition, so these directional savings are **not physical-device causal proof or a guaranteed speed budget**.
- Candidate triggers the same memoized `AppDataShell` import as DB and Home at cached-identity bootstrap, without awaiting Appwrite, changing UI, bypassing RxDB or changing auth/sync. Failed focused lint in #39012763367 for exporting a helper beside a React component; corrected by moving the shared import into the existing `routeModuleLoaders.ts` (react-refresh convention). Same parent module promise reused by route and early bootstrap.
- Add repeatable `npm run audit:slow-startup` script and independent branch-scoped credential-free runner/workflow, no mandatory CI-budget cost; captures sanitised perf marks/asset names and SW controlling state with real Vite production code. Backend requests held and never executed against real accounts.

## Next action

- Verify final SHA with focused+browser Quality Gate, run controlled lab again to check the corrected loader's timing, fix failures. Squash verified task to stable `perf/858-startup-diagnostics-20261017`, verify full canonical and trusted Preview READY (Scratch), then report user-manual PWA acceptance as **pending** until performed. Do not promote v0.29.6 to `dev` or `main` without owner's new approval. Keep #858 open pending real device acceptance.
