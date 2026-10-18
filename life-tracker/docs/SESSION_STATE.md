# Session checkpoint

Updated: 2026-10-18 UTC
Current task: issue #858 independent double-check of live v0.29.9 CI-first Scratch Preview and Todo gesture coverage.

## Approved boundary
- Owner asked to double-check, not authorize `dev`/`main`/Production promotion. Keep #858 OPEN. Stable source `perf/858-todo-row-20261018@1769452d5139d1bd67de166a40e9e1583224535d`, version v0.29.9 is unchanged; `dev@bfb0fff0c1c283f599f32db8c2a426416fa65e7b` remains v0.29.8.
- This is **test-only diagnostic task branch** `chatgpt/858-v0299-offscreen-audit-20261018`, forked directly from accepted stable Preview SHA; it must not deploy or be merged into stable without an explicit reviewed acceptance. No runtime, version, backend or data edits.
- Respect local-first task visibility, proximity dnd registration, original drag overlay, same React/DOM behaviors, offline/account isolation and Scratch-only scope.

## Verification already established
- Exact stable canonical full Quality Gate #39111921697 SUCCESS, including build/PWA/size, unit, DOM and both browser shards. Clean source task #152d989f... has the same Git tree as squash PR #950 stable SHA.
- Trusted default-main CI-first Preview workflow #39112057003 SUCCESS (receiver and deploy). Authenticated Vercel detail: `dpl_BPcVWnsVa4Q3DvrFgV7XykGqV6Du`, project `prj_jysOLDbuO9c5rP8x6Q145DVIw0fc`, READY, CLI source, target null. Exact deployment URL https://mosaic-life-tracker-foszm2q73-carls-projects-72516fde.vercel.app. No stable alias; branch auto-Git deployment disabled by design. Site is Vercel SSO-protected. Neither actual installed app nor browser login has been checked.
- Read-only Appwrite Scratch platform list: project `6a96e82d000d1310b3be` has existing web platform `*.vercel.app`, so hostname matches that broad platform entry; individual browser login not verified. No Appwrite writes.

## New audit
- Existing shipped browser regression used only 12 tasks; the audit attempt with `perf=heavy` put 10 tasks per category, and since `eagerRegister={index < 12}` is **per category**, all 50 were eagerly registered. Audit CI [#39115761769](https://github.com/carlers/mosaic-life-tracker/actions/runs/39115761769) correctly failed initial `registeredHandle count=0` on that invalid test fixture; no product regression was shown. Repair by adding a **test-harness-only** `reorderProximity=1` URL option that creates 30 tasks in the first category. The index-29 task must be visible in DOM but unregistered and offscreen, then register on first scroll, activate on first 550ms hold and cancel without dropping other rows.
- Must use `[verify:browser]` focused+both shards and investigate any failure. Do not promote this test branch or alter deployed v0.29.9 source based solely on this verification.

## Next action
- Commit repaired isolated test+checkpoint, rerun focused/browser Quality Gate, inspect exact-SHA results and report either confirmed coverage or a real failure. If real failure, isolate reproducible bug and prepare a separate reviewed refinement before redeploy; never silently overwrite existing stable Preview or consume new version without release policy. Preserve manual/installed-phone and actual task/data/Scratch authentication acceptance as pending.
