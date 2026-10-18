# Session checkpoint

Updated: 2026-10-18 UTC
Current task: Issue #858 structural Calendar/Todo rendering ablations and query critical-path analysis.

## Approved boundary
- User approved continuing performance research beyond marginal CSS containment, investigating task-count scaling, parallel query readiness, and structural render methods. Keep #858 OPEN.
- Accepted `dev@bfb0fff0c1c283f599f32db8c2a426416fa65e7b` v0.29.8 unchanged. No authorization for stable Preview/dev/main/Production/1.0 promotion or Appwrite backend changes.
- Experiment `chatgpt/858-render-graph-lab-20261018` from prior [verified diagnostic #39097381435](https://github.com/carlers/mosaic-life-tracker/actions/runs/39097381435) (`ea328e71668de2b0267f369a811f24119f12c805`). This branch contains diagnostic-only synthetic owner scaffolding, not releaseable product code.

## Evidence and design
- Previous 84-launch same-binary result: 1000 tasks on one day yielded Calendar/Todo Home-ready 397/913ms and Todo ~9706 DOM elements; 1000 across five years yielded 289/413ms and Todo ~1743 elements. Same owner/local IndexedDB; 2× CPU throttle; Home-readiness not real paint. Visual-density cost merits controlled ablation. Warm RxDB query microbench had near-zero cache-hit p50, so it does not justify parallel data queries.
- Existing cached-user `main.tsx` already concurrently preloads RxDB, Home, AppDataShell. `useRxCollection` tasks query is created after Home mount. Probe setup→first RxDB emission separately from post-emission rendering.
- Diagnostic-only opt-in variants selected by `mosaic_858_render_variant` and lab build flag; applicable to synthetic owner `issue858_scale_user` only. Calendar `active-month-only` suppresses neighbor rendering. Todo `no-dnd` disables drag runtime, `active-day-only` suppresses Day View neighbor contents, combined, and `simple-rows` substitutes inert task labels to bound TaskItem/render-wrapper cost.
- These ablations deliberately remove features and are NEVER ready to ship. Preserved-task cardinality, local owner loading, cached PWA offline/slow online and first synthetic Add button behavior remain test assertions; no drag/swipe/diary correctness claim. Test compares 0/25/250/1000 dense plus 1000 current-month and multi-year fixtures, slow online all, 1000 dense offline n=3 per condition, same compiled source.
- Experimental instrumentation records subscription creation and first task emission; `home:owner-data-ready` measures effect readiness, not first paint. A future product proposal needs full swipe/drag/Diary/shared/account isolation and installed device acceptance, plus CI-first stable Scratch Preview.

## Next action
- Run diagnostic workflow and focused Quality Gate on the exact task SHA, repair test-only failures, analyze paired absolute startup and DOM/critical-path evidence without inventing statistical certainty. Select at most one structural optimization candidate with demonstrable benefits to normal 25–250 tasks and high-density safety, not mere fast benchmarks.
- Keep both Calendar and Todo in #858 scope; never merge diagnostic code into dev/main. Security #936 and backend compatibility #914 are separate pre-1.0 gates.
