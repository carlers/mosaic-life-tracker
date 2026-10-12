# Session checkpoint

Updated: 2026-10-12
Current task: Issue #656 first-open lazy sheets, implementation authorized through stable Scratch Preview only.

## References and scope
- Base: `dev@f918b7353d05fb1d4abfdd5452f60a0e0d1db2a1`, v0.19.4; #640 accepted Day View fix remains unchanged.
- Stable Preview: `perf/first-open-sheets-656-20261012`, candidate v0.19.5. Current pre-repair SHA: `6ca955ba265123bccb4a46f9afab1124bd66ebe0`.
- Repair task: `chatgpt/656-budget-fix-4` based on that stable SHA. No dev/main promotion or backend writes approved.
- First batch: Home friend preferences, Chat stickers, Notifications friend day using resolved-component cache instead of an uninitialized `React.lazy` first render; preserve cold Suspense, stable mount type and rejected-import retry. Warm module code after view readiness and interaction intent; never hidden sheet data hooks.
- Subsequent audit/implementation in #656: friend Calendar day, nested Day View Share/Link sheets, and existing intentionally visible-loading surfaces if measured. These are explicitly **not** implemented in first Preview batch.
- Existing GIPHY, emoji, image and route-preview loading feedback remains.

## Verification and investigation
- Source PRs #661, #663, #664 squash-merged into stable Preview. Original source/browser focused checks and DOM regressions passed, including cached component first-commit/cold/retry and composer intent/focus.
- Three previous stable Preview candidates failed **unchanged seven-metric build-size guard**, including GIPHY-enabled Scratch Vercel builds. Latest `6ca955ba` [canonical CI run 38194124275] had 6/7? No: three entry metrics passed, four failed: Home closure +158 B; aggregate raw +573 B, gzip +485 B, precache +864 B. Exact Vercel deployment `dpl_5RWmYcjaNi4CYfSmNbTTYB1hsgVz` ERROR, Scratch Appwrite and GIPHY enabled.
- Latest canonical browser shard 2/2 had one empty-category drag-target mismatch in existing `interaction-contract.spec.mjs:899` (27 other tests passed). That harness is unrelated to the changed modules. Re-run before claiming a flake; investigate if repeatable. Canonical pass is mandatory.
- This repair removes standalone `scheduleModuleWarmup.ts` helper/chunk and its now-unused test; Chat/Notifications perform a simple cancellation-safe delayed module import only on usable owner view. Home chains friend preferences preload after the existing #640 Day View idle code warmup, without another timer; retains touch/hover/focus intent warmup. No guard relaxations.
- No physical device measurement or full authentication/browser acceptance has been claimed.

## Budget repair follow-up
- Fourth stable candidate `362d17d39a867fed02feb3987db1cbc213b45325` after PR #665: focused CI green, GitHub canonical build PASS all 7 size ceilings but Home had just 11 bytes gzip headroom. Exact GIPHY-enabled Scratch Vercel `dpl_DEzKjwPHMfqHbWFKxQxZSzKvSJkN` failed Home (+130 B), aggregate raw (+228 B), aggregate gzip (+209 B), precache (+347 B). Other checks remain subject to full canonical run.
- This fifth targeted repair `chatgpt/656-budget-trim-5` removes the redundant Home person-carousel preload-intent prop/handlers, keeps the #640 post-usable idle chain, simplifies resolved-component wrapper bookkeeping, and reuses a single Notifications preload intent callback. No size-limit changes, data hooks, API or backend mutations. Behavior before idle remains lazy-on-demand as in the accepted Day View pattern.

## Next action
1. Complete fifth repair branch `chatgpt/656-budget-trim-5` with `[verify:focused]`; fix any focused errors.
2. Squash task PR into stable Preview; run one new exact-SHA full canonical and GIPHY-enabled Scratch Vercel build. All seven original budgets must pass. If a browser contract fails, review logs and fix or reverify.
3. Verify Vercel SHA, Scratch backend, version 0.19.5 and stable Preview alias. Update #656 issue checkpoint with exact tested evidence and remaining second-batch tasks.
4. Device testing pending for first-open after reload/idle and rapid touch, offline and nested Back behavior. Do not merge to dev/main without explicit separate authorization.
