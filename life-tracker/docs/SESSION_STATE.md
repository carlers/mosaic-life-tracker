# Issue #1441 — B2/B3 completion, reschedule and soft-delete v0.56.0 candidate (2026-11-02 Asia/Manila)

- Owner authorized one-Go completion of voice, optional AI, B0–B3 commands and secure Scratch-only MCP. Whisper and AI model files must remain independently deletable. No dev/main/Production promotion without new explicit authorization.
- Accepted B1 stable source: feature/1441-local-whisper-preview-v0524-20261101@905c8094a54a4183aa7623c6f5a1740f1d7c800d, v0.55.0. Full canonical #41336380646 SUCCESS; exact Preview dpl_B46QvAveA8aLcrhifdsQPwx73Yax READY.
- B2/B3 candidate adds strict owner-only command grammar: complete all unfinished tasks in CATEGORY; complete my overdue tasks in CATEGORY; reschedule all unfinished tasks in CATEGORY to YYYY-MM-DD or tomorrow; delete all tasks in CATEGORY. Preview lists exact local owner rows, excludes deleted/foreign tasks, and applies 20-item cap with no preselected items for larger sets. Typed COMPLETE N, RESCHEDULE N or DELETE N confirmation; DELETE additionally needs separate explicit checkbox.
- Domain hook requires online state, fresh successful all-groups Sync Now (within 5 minutes) and exact local scope revalidation; per-task atomic RxDB incrementalModify with version/owner/category/date/completion/deleted/visibility checks. Coordinator is bounded/serial, partial result/cancel aware, records 15-minute owner-scoped undo journal and refuses compensation after intervening updates. Deletion is a tombstone isDeleted=true, never hard delete. No global cross-device atomicity claims.
- B1 move coordinator and model controls retained; pure mutation and DOM regressions added. Local B2/B3 TypeScript/ESLint/tests and production/PWA/size build checked; task CI/stable Preview pending at checkpoint.
- Remaining: physical Brave/Android model downloads, memory, transcription quality and deletion tests; multi-device Scratch sync and undo manual acceptance; secure external MCP authorization-server/client/consent and Scratch Function deployment. No backend changes or dev/main/Production approval. Keep #1441 open.

---

# Issue #1441 — bulk move confirmation v0.55.0 candidate (2026-11-02 Asia/Manila)

- Single-Go authorization: complete voice, local AI, B0-B3 bulk and external MCP safely in Scratch Preview. Keep Whisper/AI models independently deletable. No dev/main/Production promotion without new approval.
- Starting stable source: feature/1441-local-whisper-preview-v0524-20261101@bb2e2f8d8850d63e7b4afc2b74e0243e355d8069, v0.54.0, full canonical #41333641392 SUCCESS, Vercel Preview dpl_2xiJT1MQVE8Sf4zVrDWcU6sF78Yw READY.
- B1 v0.55.0 candidate: owner-scoped selection max 20 (no default selection if >20), typed MOVE N confirmation, recent successful full Sync Now under five minutes, local owner/scope re-query and per-task owner/version atomic RxDB incrementalModify, partial outcomes/cancel, private Backlogs, and owner-scoped 15-minute sessionStorage undo journal with conflict checks and remount recovery. The domain hook is lazy-loaded in HomeCommandSheet to preserve Home's blocking size budget. Global cross-device atomicity is not promised.
- Focused local B1: 8 parser/coordinator unit PASS, 14 command sheet DOM PASS, TypeScript, lint, contracts, version and production/PWA/Home size PASS. GitHub task/CI/Preview status must be verified before claiming acceptance.
- Remaining: B2 completion/reschedule, B3 reversible bulk deletion, external authenticated MCP with Scratch-only OAuth/scoped permissions and live disposable-account security tests; model actual Brave/Android performance and deletion acceptance. Issue stays OPEN.

---

# Issue #1441 — local model language + optional AI v0.54.0 (2026-11-02 Asia/Manila)

- Owner's single-Go authorization covers voice refinement, local AI, bulk B0–B3 and external MCP. **Separate deletion controls for Whisper and AI are mandatory.** Scope is isolated Scratch Preview; dev/main/Production promotion requires separate approval.
- This task adds opt-in **multilingual Whisper Tiny**, retaining the existing opt-in English model. An explicit MosaicSelect switches languages and restarts the worker; both English and multilingual CacheStorage keys are independently isolated and **Delete downloaded Whisper models** clears both model namespaces and matching prior legacy Whisper requests without touching PWA/task offline data.
- Optional local Qwen3 0.6B ONNX q4f16 WebGPU command suggester runs in a separate opt-in Worker with pinned revision and cache namespace \`mosaic-local-intent-v1\`. UI includes consent, Prepare, Cancel and **Delete downloaded AI model**, also available with consent disabled. Suggestions are editable text; user must explicitly choose Use suggestion and review or confirm within existing deterministic command UI. AI cannot access RxDB or create, edit, or delete any task; typed parser always works without WebGPU/model. No automatic AI download.
- Model cards at HF: \`onnx-community/whisper-tiny@ff4177021cc41f7db950912b73ea4fdf7d01d8e7\`, \`onnx-community/Qwen3-0.6B-ONNX@58ca03a5e7b354b480b1a82b34bde8dc7b854cc0\`. Real Brave/Android download, GPU memory, WebGPU inference, accuracy, Taglish and deletion testing remain **manual**, not proven by unit/CI.
- Previous v0.53.0 stable Preview \`feature/1441-local-whisper-preview-v0524-20261101@db0b887e41690461bfaba79243d1d8fa027586e5\`: canonical #41330577033 SUCCESS, Vercel \`dpl_GkLsJnaFmC1SfXvgRLcKtH76A9oJ\` READY. B0 read-only bulk move visible; B1 pure guarded executor unwired. B1–B3 execution, MCP, and broad model benchmarking remain incomplete; no backend/Production changes.
- Next verify focused unit/DOM/TypeScript and build, publish task branch + focused CI, squash stable Preview, full canonical and exact-SHA Vercel READY; run manual device acceptance; continue scope on isolated task branches. Keep issue open.

---

# Issue #1441 — bounded optimistic bulk move execution core, not enabled (2026-11-02 Asia/Manila)

- Owner's one-Go authorization remains in force: complete Whisper/mobile voice, optional AI model evaluation, safe B0–B3 bulk commands, secured external MCP on Scratch Preview. Model weights must be individually deletable. Never promote dev/main/Production without explicit user instruction.
- B0 v0.53.0 stable Preview at SHA `2106b5ae6ba79cf348868dbf74ab64ed9730fa8e` accepted: focused CI #41329180682, full canonical #41329464519, exact commit Vercel deployment `dpl_71dynSN8f2Nvxcq7wHzMo5SoohEX` READY. B0 is strictly read-only and warns local/offline selection is not complete remote state.
- New **unwired** bulk move executor `src/lib/taskBulkCommandExecution.ts`: max 100 distinct signed-in owner rows per batch; explicit owner/source/destination validation; frozen snapshot IDs and fields; serial per-row reads plus required *atomic compare-and-patch adapter* (no unconditional updates); conflict/partial failure/cancellation/progress outcomes; Backlogs privacy; conflict-aware undo refusing intervening edits/owner changes. Adapter intentionally not connected to RxDB or UI; no task writes can be invoked by this unshipped core. Does **not** claim cross-device completeness, persistent undo journal, or resolved destination order semantics.
- Isolated exact-source sandbox focused verification: 8 unit tests (4 prior B0 + 4 new execution) PASS, TypeScript noEmit PASS, changed-file ESLint PASS. This milestone is no user-visible behavior change (version remains 0.53.0); CI and stable Preview canonical pending.
- Next: implement and verify atomic owner-scoped RxDB adapter, bounded queue with confirmation and deterministic destination ordering, per-owner undo journal and sync completeness checks; then enable safe B1 UI. B2 completion/rescheduling and B3 soft deletion remain unimplemented. Additional Whisper/AI/MCP tasks remain outstanding. No app backend changes.

---

# Issue #1441 — B0 read-only bulk command preview v0.53.0 (2026-11-02 Asia/Manila)

- Owner's one-Go authorization covers voice and on-device models, AI evaluation, B0–B3 bulk commands, and secured external MCP. Models must be *individually deletable*. Do not promote to dev/main/Production without further authorization.
- B0 extends the existing Home command launcher with explicit `move all [uncompleted/completed] tasks from <owner category> to <owner category|Backlogs>` parser and **read-only** review of matching local owner tasks, per-task date/completion, destination/no-ops, limited visible list. No bulk writes, undo, external API, migrations or server calls. The preview explicitly warns that offline-local results are not guaranteed to cover all remote tasks.
- Exact owner category matching rejects cross-owner, missing, duplicate and ambiguous names. Unknown bulk move grammars cannot degrade into a single-task create operation. Voice and typed input share the same draft command; transcript editing invalidates prior previews. Existing single-task creation remains gated by manual review/confirmation.
- B0 test proof: local unit 4/4 PASS, updated Home command sheet DOM 11/11 PASS, TS check PASS, production/PWA/size build PASS at a detached exact-parent working checkout. The extra staging files were reconstructed byte-for-byte in GitHub blobs and matched local git hashes. Focused CI, canonical and exact Vercel Preview pending for new commit.
- v0.52.5 Whisper model deletion already merged as PR #1605 into stable `feature/1441-local-whisper-preview-v0524-20261101@9fbc052900cb35b602510605289f6cd73b1fa54e`; focused #41326728127 and full canonical #41326994014 SUCCESS; exact-SHA Preview deployment `dpl_FJYPgKJCkkGRfp2zXhFDUBorQ2jf` READY. Model deletion remains subject to physical-device acceptance.
- Next work: deliver B0 through focused CI, squash stable Preview, canonical, READY. Then implement safe B1–B3 with owner-query revalidation, conflict-aware undo, bounded queue and partial errors; improve speech and evaluate optional model with own deletion control; independently authorized Scratch MCP must default to read-only and enforce authorization, replay safety and consent. Forward integration with independently evolving dev must resolve merge/build budget conflicts without weakening gates.

---

# Issue #1441 — optional model storage control v0.52.5 (2026-11-02 Asia/Manila)

- Owner authorized completion of voice, local intent evaluation, safe bulk commands, and external MCP against Scratch Preview only; specifically requires both Whisper and any future local AI model to be individually deletable. Preserve typed commands, no silent model downloads, and no dev/main/Production promotion.
- First scoped task from accepted Whisper stable Preview `feature/1441-local-whisper-preview-v0524-20261101@995a5024b5eba8b5115507e8700988532d857468`: dedicate Transformers.js CacheStorage key `mosaic-local-whisper-v1` for Whisper and reserve distinct `mosaic-local-intent-v1` for a future optional AI model. New local model manager deletes the specified namespace; Whisper deletion additionally removes **only** previous `onnx-community/whisper-tiny.en` weights from legacy shared `transformers-cache`. Cancel terminates worker/releases mic before deleting; unrelated PWA/task/media caches stay untouched.
- Inline Delete downloaded Whisper button is available without opt-in and immediately unloads the active worker. Failed cache deletion reports a failure; no unsupported full-browser/HTTP runtime cache deletion is claimed. Future optional AI model must use its isolated key and expose its own Delete action before release; no AI model is installed by this task.
- Isolated sandbox on original stable SHA: 3 new cache-isolation unit tests PASS; existing Whisper DOM tests PASS; contracts and original v0.52.4 production/PWA/size build PASS. v0.52.5 version contract passed; focused CI/canonical and exact Preview deployment pending until publishing.
- Forward reconciliation experiment against dev@e0094b386d47bcdb02a2bc69c57d02a10935db7c (v0.67.0): resolved six initial file conflicts, installed existing Whisper/Chrono dependencies and verified 13/13 focused units. Combined build exceeded enforced Home gzip budget by 13 B after replacing wand with mic; not accepted and not published. Preserve dev safety gates; re-evaluate from live refs.
- Next: focused gate on task branch, squash into isolated stable Preview, full canonical and exact SHA Preview; continue #1441 with multilingual/device acceptance and separately staged safe bulk B0-B3 and secure MCP read-only-first. No dev/main/Production promotion.

---

# Whisper v0.52.4 Preview CI repair — issue #1441
Updated: 2026-11-01 Asia/Manila

- PR #1592 merged into stable `feature/1441-local-whisper-preview-v0524-20261101@95c336426d8cc0ca435d48475c9e5f0cebe3cf48` after task focused CI success (#41313327568). Stable full CI #41321625617 exposed a build-artifact trust failure: the optional bundled 26.86 MB `ort-wasm-simd-threaded.asyncify` asset exceeded the ordinary 8 MiB per-file tar limit. App build and blocking startup/Home/PWA budgets passed; no deployment was accepted.
- Repair on `chatgpt/**`: permit only Vite-hashed `assets/ort-wasm-simd-threaded.asyncify-XXXXXXXX.wasm` up to 28 MiB; preserve 8 MiB for all other files, 32 MiB total decompression, tar structural checks, exact inventory digests and CI authorization fences. Tests cover the expected asset, unrelated oversize and over-limit rejection.
- Exact stable-SHA isolated Vercel Sandbox: five archive-trust unit tests passed, contracts and diff checks passed, Preview-mode Vite production build/PWA and blocking size checks passed, 200-file archived build verified successfully. No Appwrite changes.
- Next safe step: pass task focused gate, squash repair into stable Preview, pass full canonical and exact-SHA Scratch Vercel READY. Require real Brave/Android mic, model download, transcription, cancellation and memory acceptance. No dev/main/Production promotion without approval; bulk commands unapproved.

---

# Task checkpoint — #1441 experimental Brave-compatible local Whisper voice v0.52.4
Updated: 2026-11-01 Asia/Manila

- User confirmed the ~71MB whisper.cpp browser demo transcribed successfully on Brave laptop. User previously asked to get Brave voice working in Mosaic. Proceed with *Preview-only*, opt-in device-local voice spike, retaining existing browser SpeechRecognition and typed commands.
- Base accepted command Preview fix/1441-brave-speech-guidance-v0523-20261101@a2ccd05e3f8dc0be0b4cb6141dbd23485129f8ba; dev diverged and is separately repairing RxDB schema. No merge to dev/main/Production.
- Added pinned Transformers.js v4.3.2 q8 Whisper tiny.en in dedicated localWhisperWorker, with pinned HF revision 2575352d61be1bf7225cf8f8b268a4678025fc58. Model fetched only after opt-in Prepare. MediaRecorder captures max 15s, decodes/resamples locally to PCM16k, worker performs ASR, transcript goes into existing editable review; no audio upload or automatic task writes. Separate consent/mic stop/cancel. Model is *not* the exact 71 MB tested demo model; browser compatibility and Taglish quality unverified.
- Exclude only opt-in localWhisperWorker JS and ort-wasm binaries from mandatory SW precache, retain strict offline verification for all other app chunks; optional runtime model files may require network if not cached. Initial and Home closure budgets pass, aggregate bytes advisory increase expected; need capture exact build metrics.
- Isolated sandbox: pinned model q8 loaded and transcribed a synthetic silent audio vector using Node CPU backend; 27 UI/parser/permissions tests, lint 0 errors, project contracts and production PWA build passed. No end-to-end Brave model run, microphone hardware or Android measured. CI and exact Preview readiness pending.
- Before promotion beyond Preview: user device retest with actual model download/latency/memory/permission and no task save without manual review, offline/cache behavior, optional speech cleanup. Bulk task actions remain disabled. No backend/appwrite changes.

---

# Task checkpoint — #1441 Brave browser Web Speech provider feedback v0.52.3
Updated: 2026-11-01 Asia/Manila

- Owner reports speech error "The browser speech service could not connect" specifically on desktop Brave after v0.52.2 microphone Permissions-Policy repair. Brave public upstream issues #18569, #2802 and on-device project #56487 support browser-level transcription backend incompatibility independent of microphone permission. User's device-specific failure is not proof of internet outage or application microphone denial.
- Next Preview v0.52.3 on accepted fix/1441-speech-microphone-v0522-20261101@3082f71341235b8cc1ce05c9f85e67a55a1b99b6. Use navigator.brave.isBrave() only as an advisory; keep actual WebSpeech attempts allowed, show Brave-specific guidance on network/service refusal and explain typed/OS dictation/Chrome fallback. No new engine/remote transcript handling, data model or elevated operations.
- Unit and DOM coverage includes async Brave identification, error classification, the review sheet warning, and create actions remaining gated behind manual confirmation. User still must test real Brave and Android devices; voice in Brave cannot be guaranteed until browser provider or independent opt-in on-device STT is available.
- Future offline on-device speech model is planning only, subject to download, memory and privacy acceptance. Bulk-command execution remains disabled.
- Candidate scoped CI/Preview verification pending. Never promote Preview to dev/main/Production without separate approval.

---


# Task checkpoint — #1441 microphone permission policy repair and bulk command plan v0.52.2
Updated: 2026-11-01 Asia/Manila

- The user reported identical Web Speech permission errors on Android and laptop. Root cause located in Vercel response policy: microphone=() explicitly blocks all audio input. The trusted prebuilt config and route builder also duplicated it. Change all four policy sites to microphone=(self), retaining camera/geolocation denies.
- Improve browser speech error classification; preserve explicit microphone consent, editable transcript, owner-local task confirmation, no backend changes. No claim of end-to-end device speech verification before owner retest.
- Candidate v0.52.2 PATCH from accepted v0.52.1 command Preview branch @ff58556b76de60f48f774ebca50ea98cdec593f7. dev has diverged with v0.62.0. No dev/main/Production promotion authorized.
- Separate read-only bulk-command roadmap added at docs/COMMAND_BULK_PLAN.md; no bulk mutations implemented. B0 parser/preview, B1 owner-only bulk move with revalidation/undo, B2 completion/reschedule, B3 reversible soft delete. Excluded other users, hard deletes, unconfirmed writes.
- Scoped test/CI and exact Preview deployment evidence pending until release; Android, laptop and offline speech need manual verification.

---


# Task checkpoint — #1441 typed command Preview refinement v0.52.1
Updated: 2026-11-01 Asia/Manila

- Owner tested v0.52.0 Preview and requested Mosaic dropdown, partial commands, create-missing-category option, voice and UI improvements. Scope single-task creation with explicit confirmation; no bulk execution, cloud model, backend/schema change or dev/main/Production promotion.
- Base accepted Preview feature/1441-typed-command-preview-v0520-20261101@d101c05bcde0b5750b801da881e2118bc614bc4c. Candidate v0.52.1 PATCH (next testable revision of same feature); dev has diverged. Keep independent stable Preview branch for v0.52.1.
- Added conservative parseTaskCommandPreview with title/category extraction and absent-date preservation; MosaicSelect category; Today/Tomorrow/Backlogs shortcuts and explicit date; unknown category explicit private creation on confirmation via useCategories hook; isolated on-demand command mutation module and voice hook with consent, browser API fallback, session cleanup. No write on parse.
- Focused local Vitest 22/22 passed (parser, UI, owner/category creation); lint and production build with blocking PWA/Home size budgets passed. Canonical CI and exact-SHA Vercel Preview readiness remain to verify after commit.
- Manual/device: browser microphone privacy and permission, Chrome Android PWA, account switch, offline task creation/sync and category visibility. Browser speech may use remote provider; no offline guarantee. Original 168+30+88+40 synthetic results cannot verify user-input accuracy.
- Never promote Preview to dev or main without separate explicit approval.

---

# Task checkpoint — #1441 interactive typed command Preview v0.52.0
Updated: 2026-11-01 Asia/Manila

- Owner authorized a testable implementation **to Preview only**. Scope is single confirmed owner-local task creation from typed natural language; no microphone, bulk actions, model inference or backend change.
- Based on dev@45b529a99b3bd7fe88223d4b3108f1a7e0ee96a1 (v0.50.3); separate research parser branch feature/1441-parser-hardening-20261101@7253f197. Another Preview uses v0.51.1, so proposed v0.52.0 avoids collision. Recheck branch/version on delivery.
- Lazy HomeCommandSheet and taskCommands parser with Chrono 2.10.3; editable review, owner/category verification at submit, one task via useTasks.addTask, no writes on parse/cancel, backlog defaults to private.
- Added 30+88+40 unit regression fixtures and UI confirmation/category/launcher tests. Sandbox Vitest 12/12, lint and production build with startup/Home size gates passed. Focused CI revealed missing appVersion/index contracts; repaired all three, and npm run contracts:check passed. Focused CI passed; stable canonical #41225049605 failed existing HomePageSearchFlow DOM fixture because useAuth was not mocked. The owner-scoped test harness was repaired: targeted 17/17 DOM tests and project contracts pass locally. Re-run canonical and exact-SHA Preview readiness pending.
- Appwrite scratch/Production not changed; frontend-only change. Manual mobile/PWA/Android Back, account switches and offline-sync acceptance remain owner checks. No automatic promotion to dev/main/Production.

---

# Task checkpoint — Day View one-day swipe momentum and photo drag, v0.50.3 reconciled dev promotion
Updated: 2026-11-01 Asia/Manila

- Owner accepted physical feel of original stable `fix/dayview-single-day-snap-photo-v0447-20261031@73692710122bd47b1ff5b0e28a6e963465701a7e`, explicitly approved merging to `dev`, and requested remaining-work audit. No `main` or Production approval. Original canonical #41216695153, exact-SHA trusted Vercel READY; integrated v0.49.1 canonical #41219378958 passed; integrated v0.50.1 canonical #41220167638 succeeded on attempt 2, including all browser shards (initial unrelated split-panel resize intermittent failure).
- Live `dev@afdca35ac2f0287b04a24f19af21a73d4a1b9838` has since gained accepted v0.50.2 Calendar scroll fix #1510, on top of Storage v0.50.0, Day View settings/sorting and search. Previous stable `fix/dayview-swipe-integrated-v0501-20261101` advanced to `86c2e2335c9abb6f2b161024ed94c0f5b3944949` through #1511 selection-mode photo test; its exact-SHA canonical #41221212354 succeeded. Do not merge stale Preview with version regression; preserve Calendar's source and new scroll test in `interaction-contract.spec.mjs`.
- Reconciliation task `chatgpt/dayview-swipe-forward-v0503-20261101` and stable `fix/dayview-swipe-integrated-v0503-20261101` derive from current dev v0.50.2. Apply only the exact accepted DayViewSheet momentum/release source blob, native photo dragging protection, Swiper FreeMode mock, current photo DOM regression (including selection-mode), and add only the single-gesture fling/partial-snap browser test to dev's existing interaction contract. The version is v0.50.3; other source/test/docs from dev are preserved.
- Verify task focused/browser, stable exact-SHA full canonical/size/registered Scratch Vercel READY, current dev SHA, promotion tree parity and configured repo preflight. Then owner-approved Preview→dev PR, checking dev checks and deployment. No backend or Production writes.
- Follow-up audit (read only): no confirmed new Day View momentum defect; device-level tests, #1008 WebKit browser lane, #858 performance diagnostics and #855 older distant-date repro remain separate unverified/ongoing work.

---

# Task checkpoint — #1388 Calendar scroll v0.50.2 integrated candidate
Updated: 2026-11-01 Asia/Manila

- Owner confirmed v0.43.13 live DevTools viewport-cap test restored Calendar scrolling, then authorized merging Calendar fix to `dev`. No main/Production approval.
- Original accepted Preview `fix/calendar-long-grid-scroll-20261027@080959b4c7ff7c38fa993893523ed1f828c1eeda` passed canonical Quality Gate #41186816066 attempt 3 and exact-SHA Vercel READY. It is version 0.43.13. Direct promotion would regress version from latest dev 0.50.0.
- Integrated task `chatgpt/1388-calendar-scroll-forward-v0502-20261101` and stable Preview `fix/1388-calendar-scroll-integrated-v0502-20261101` begin from exact dev `f01a43479baa476d4ed1c8074a430a1065af66f7`. Apply only the accepted Calendar-related frontend changes and browser regressions, leaving all other dev features and docs intact. New version **0.50.2** (0.50.1 reserved by active dayview Preview).
- Required: task focused+browser CI, squash PR into stable integration Preview, full canonical Quality Gate, exact SHA Vercel READY, GitHub/Vercel read-only promotion preflight, then approved stable Preview → dev PR (only if dev HEAD still matches safe base; reconcile drift otherwise). No main/Production promotion, backend data migration, CI bypass or user-account changes.
- Outstanding manual: hosted v0.50.2 Preview parity with owner-confirmed DevTools fix and phone view may still need separate verification; user approved dev merge after successful live-page clamp and accepted previous Preview.

---

# Task checkpoint — #1476 approved v0.50.0 Storage promotion, docs-only dev drift
Updated: 2026-10-31 Asia/Manila

- Owner accepted Phase 1 and authorized dev merge, then Phase 2 #1477. No main/Production authorization.
- Accepted v0.50.0 Storage Preview `feature/1476-storage-integrated-v0500-20261031@971eeb2d92ceedfa733a72691368f2f8dcc76f77` passed full Quality Gate #41218156275, Trusted Preview Delivery and exact-SHA Scratch Vercel READY. Owner accepted functionality originally at v0.48.0; version reallocated after dev reached v0.49.0.
- Promotion PR #1502 passed preflight but dev advanced to `7ac1a99427750a95c1d9c3da0593f72c650214e4` (documentation-only workflow #1501). GitHub refused merge with SESSION_STATE conflict. New task `chatgpt/1476-storage-doc-reconcile-v0500-20261031` forward-ports the **same accepted v0.50.0 app source and version**, preserving latest dev AGENTS/workflow/Scratch instructions and this checkpoint. Stable `feature/1476-storage-final-v0500-20261031` must pass focused/canonical/Preview before dev promotion.
- Phase 2 #1477 to follow successful dev promotion; owner-scoped read-only media metadata only, never cloud deletion or fabricated account quotas.

---

# Task checkpoint — Vercel Sandbox operational path for #1461
Updated: 2026-10-31 Asia/Manila

- User requested a permanent rule: try Vercel Sandbox before requesting manual terminal execution. Existing official Vercel project Sandbox history from October 22/31 and a newly created disposable Sandbox confirm shell access and exact-SHA Git checkout are available in this connected Chat.
- New Sandbox `mosaic-1461-scratch-ops-probe-20261031` executed Git/Bash/Node at `/vercel/mosaic-life-tracker`; checkout `faae41b5bf93e72f4c9b6f8ec75bef720966c4b8` clean; Frankfurt Scratch endpoint reachable without authentication (HTTP 401).
- No `APPWRITE_API_KEY` inherited in Sandbox. Shell works; Scratch migration 016, Function deployment, historical scrub and two-account privacy acceptance remain blocked by lack of an authorized Scratch-scoped administrative credential. No Scratch/Production mutation.
- Documented rule in `AGENTS.md`, `AI_WORKFLOW.md` and `SCRATCH_PREVIEW_WORKFLOW.md`; version impact NONE. Do not promote #1461 Preview feature to dev or Production as part of docs-only workflow update.

---

# Task checkpoint — #951 Day View v0.49.0 integrated promotion candidate
Updated: 2026-10-31 Asia/Manila

- Owner explicitly approved merging the accepted Day View settings + Timeline Completed-last Preview to `dev`; `main`/Production remain unapproved. Original accepted Preview `feature/951-dayview-settings-sort-v0490-20261031@9f3080cbb40c475c49ef6c080f448f14f4d12d64` has canonical #41212463460 SUCCESS and matching Scratch Vercel READY.
- Original Preview diverged because `dev` advanced to `215bbe86b39ea779120d2882a6086e0756f55d5c` v0.47.1 with #1473 Uncompleted Tasks search and earlier #1466 Home search pagination. GitHub comparison verifies these additions touch only Uncompleted Tasks source/tests, three version files and this checkpoint, not any Day View/Settings implementation files. Preserve both completed features exactly.
- Forward port original accepted source/test blobs unchanged to current `dev`; preserve its whole checkpoint below, carry accepted v0.49.0 in the three version files without bump, and create `chatgpt/951-dayview-settings-forward-v0490-20261031` → `feature/951-dayview-settings-integrated-v0490-20261031`. Source includes the direct Day View gear/route, restored selected date, related Tasks & Calendar navigation, Timeline Completed last + Newest/Oldest and prior Completed first/mobile header regressions.
- Required steps: task focused CI; squash into integrated stable Preview; exact-SHA canonical checks and Vercel Scratch READY; verify dev has not moved again; then owner-authorized stable Preview → dev PR merge preserving identical tree. Do not merge stale original Preview or skip gates; device/manual checks remain unverified.

---

# Task checkpoint — #1473 Uncompleted Task search v0.47.1 integrated Preview candidate
Updated: 2026-10-31 Asia/Manila

- Owner accepted user-visible v0.47.0 Uncompleted Task search Preview from issue #1473 and requested removal of the white separator directly beneath the expanded search input followed by promotion to `dev` (explicit promotion approval only for this feature; no `main` or Production approval).
- New `dev@343b857fa43d26e7afc7b7f6de81ac479416bba2` is v0.45.0 including #1466 Home task search pagination. To preserve that completed work, forward-port the accepted #1473 v0.47.0 source and existing focused regressions onto current dev and remove **only** the expanded Uncompleted Search container `border-b border-border` classes. The input's own border, existing header divider, groups, owner privacy, task operations and app behavior remain unchanged.
- Revision uses v0.47.1 PATCH after first successfully delivered v0.47.0 Preview. Task branch `chatgpt/1473-search-divider-forward-v0471-20261031`; new stable Preview `feature/1473-uncompleted-search-v0471-20261031`. The source page, helper and both existing test files come from accepted #1473 Preview; version and all other files come from latest dev. No backend/schema/sync change.
- Run focused checks, squash task PR into new stable Preview, full canonical build/size/browser CI and trusted Vercel Scratch READY. Verify branch/version drift and exact source tree before explicit accepted Preview → `dev` merge; if dev advanced again, reconcile into a fresh integrated Preview and reverify before merge. Required real device/login acceptance remains unverified until performed; no Production modification.

---

# Task checkpoint — #1466 Home task search incremental results v0.45.0
Updated: 2026-10-31 Asia/Manila

- Authorized implementation of Home Search `Load more tasks` in 50-result increments. Source baseline: `dev@4aec8d63ef460cbc56a8f895f0f609a2152ea459` (v0.44.4). Task branch: `chatgpt/home-task-search-load-more-v0450-20261031`; target stable Preview: `feature/1466-home-search-load-more-v0450-20261031`.
- Scope: change only the lazy Home Search results window; preserve local RxDB owner-only input, ranked search, filters and Day View/Backlogs navigation. Initial 50 matches; Load more appends 50; reset window when query/filters change or search clears/closes. Preserve scroll offset on append. No Appwrite, migration, dependency or Production change.
- Files: `src/components/home/HomeTaskSearchExpanded.tsx`, existing DOM/unit search regressions, three version files, this checkpoint and §2 search contract. Candidate Preview version `0.45.0`.
- Delivery: commit one coherent task tree with `[verify:focused]`, inspect focused CI; only after green squash via PR to stable Preview, then verify exact-SHA canonical CI, size/PWA and official Scratch Vercel READY. Manual phone scroll/focus acceptance remains separate. No approval to promote to `dev` or `main` or modify Production. Issue #1466 remains open until delivery acceptance.

---

# Task checkpoint — #1443 Preferences replication integrated v0.44.4
Updated: 2026-10-31 Asia/Manila

- User expressly authorized merging the accepted preferences-sync repair to `dev`; current integration baseline is `dev@43d40603fa5e59c0d3a1bd1363ab69a3aefff6ff` v0.44.3 with both #1386 page swipe and cold-start work. Old v0.44.1 isolated Preview cannot promote over newer versions.
- First v0.44.4 candidate from v0.44.2 at `fix/1443-preferences-sync-v0444-20261031@fe22206390770dd9a791e84a5cb47ecd831cc0c3` passed full canonical on retry (browser drag test was intermittently red), but publisher found no attempt-2-matching artifact, and concurrent v0.44.3 promotion advanced dev. That candidate was not delivered/promoted.
- Current forward-port task `chatgpt/1443-sync-forward-0443-v0444-20261031` and stable Preview `fix/1443-preferences-sync-v0444-integrated-20261031` apply the **same unchanged five preference source/test blobs** on latest dev v0.44.3. Assign v0.44.4 as the next available patch without modifying swipe performance behavior. Run focused verification, squash into stable Preview, full canonical CI and trusted Vercel Scratch READY. Then merge only this accepted source into `dev` per owner approval, checking dev head drift again. No main or Production mutation.
- Core fix: migrate legacy oversized-ID preference values to valid owner/key IDs before local cleanup and skip only impossible-remote oversized physical-deletion RxDB queue entries. Valid-ID deletion remains tombstone-only; preserve user isolation. Real production-device sync acceptance remains pending; leave #1443 open.

---

# Task checkpoint — #1386 cold first-swipe preparation (Phase 1+2)
Updated: 2026-10-31 Asia/Manila

- The user-approved v0.44.2 prepared-page forward-port was merged to protected `dev@a9f1650f9b262705413b64e3d5b2288b53620e83` via PR #1449 after stable Preview #1448, exact-SHA canonical, Vercel READY and unchanged-tree merge. Production/main unchanged.
- Next candidate v0.44.3 branches from that dev merge. It shares the returning-Home initial preload with the route's prepared component cache instead of a disconnected module import, and schedules neighbor code after Home local data readiness and next paint. Non-Home neighbor preloads advance to the next post-paint frame; messages keep their earlier immediate warmup.
- The new one-shot startup readiness listener is cancellation-safe and side-effect free for synced data. Optional Home neighbor module-readiness marks are included in the synthetic mobile audit; **no physical-device or authenticated-PWA timing is claimed**. Full installed PWA swipe/content settle audit still needed.
- Tests exercise Home first render, mark subscriptions (early, late, canceled, failure isolation), and existing route/gesture contracts. No data/provider/backend/Production changes. New v0.44.3 user-testable refinement requires task focused CI then fresh stable Preview canonical/size/Vercel; no automatic dev/main promotion for this iteration.
- Outstanding cross-workstream: #1443 preferences sync Preview reserves v0.44.1, and may need version reconciliation after v0.44.2 dev promotion.

---

# Task checkpoint — #1386 swipe first-frame / Settings compatibility
Updated: 2026-10-31 Asia/Manila

- User authorized promotion of previously accepted v0.43.9 swipe Preview to dev, followed by cold-start work. At request time dev had already received unrelated v0.44.0 Settings/Me reorganization (dev `efeec22df14b4cb9d8dc1ffa3d5852e7af4a1775`). The old v0.43.9 tree diverged, was lower-versioned and omitted new Settings routes; exact older-tree promotion is unsafe.
- This v0.44.2 forward-port starts from current dev, retains all v0.44.0 Settings routes, and carries the previously accepted prepared route module caching to actual routes and swipe previews. Reuses each Settings/Preferences page with its original pathname-aware preview props. Adds deferred Settings child module warmup and focused regression.
- v0.44.1 is separately reserved by #1443 preferences sync Preview. Do not alter or promote that work in this task.
- New task `chatgpt/1386-swipe-forward-port-v0442-20261031`, target stable `perf/1386-swipe-forward-port-v0442-20261031`; run focused CI, squash task into stable Preview, verify full canonical and exact Vercel READY, and only then request approved dev PR merge. No main or Production promotion.
- Next cold-start refinement (Phase 1+2) should branch from the promoted dev source after verifying branch head; measure cold first-swipe vs warm and consolidate duplicate Home preload module identity, without blanket eager page mounts or data side effects. Maintain navigation/back/gesture/reduced motion and account isolation.

---

# Session checkpoint
Updated: 2026-10-27 Asia/Manila
Current task: #1384 Settings and Me reorganization, full Preview acceptance repair; task branch `chatgpt/1384-preview-preload-registry-fix-20261027`, based on stable Preview `feature/1384-settings-information-architecture-preview-20261027@4a8eb1dc7b1143cf29b7cca18a1ea1c447507859`.

## Objective, scope and constraints
Owner approved Settings categories, search, Me tap-navigation with **no visual change to Me**, and legacy placeholder cleanup. Frontend only, v0.44.0 Preview. No `dev`/`main`/Production promotion or provider/backend/data edits approved.

## Accepted task checkpoint
- Task PR #1392 squash merged into protected stable Preview SHA `4a8eb1dc7b1143cf29b7cca18a1ea1c447507859`. Final task focused Quality Gate #40506056120 passed. Earlier #40504980671 and #40505469873 passed. Current code includes Account, Data & Sync, About Mosaic, five categorized Preferences pages, local index for individual preferences and Notifications, source-compatible Settings route-preview destination rendering and unchanged Me classes.
- Stable canonical Quality Gate #40506296566 failed the `build` job at TypeScript `TS2740` because `src/components/layout/primaryRoutePreload.ts` mapped old preview-supported routes only and lacked all eight new supported Settings/Preferences child paths. Stable DOM and dependency-audit jobs passed; browser tests in progress at diagnosis. No successful build/deployment should be inferred from source merge.

## Repair and next action
- Add exactly the eight route preload entries to existing module importers, preserving lazy bounded warm-loading and exhaustive `PreloadPath` type contract. No other runtime design changes.
- Run focused verification on coherent repair task commit; squash into existing stable Preview only after green; require new stable exact-SHA full canonical CI, production size budget, official Scratch Vercel READY, and relevant browser/device checks. Keep issue #1384 open and request separate approval before any promotion to `dev` or `main`.
- Do not weaken typing, size ceilings, security, sync, or release gates.
