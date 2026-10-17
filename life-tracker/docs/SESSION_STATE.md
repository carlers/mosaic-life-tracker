# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 default Calendar first dense-day interaction performance audit, diagnostic-only.

## Accepted state
- v0.29.8 source Preview `7429dab8b5a9f553e66cbb699d9b2beb1ac42cb7`, promoted through PR #949 to `dev@bfb0fff0c1c283f599f32db8c2a426416fa65e7b`; accepted canonical CI and dev Vercel READY. #858 remains OPEN; no more dev/main/Production/1.0 promotion authorized.
- Prior synthetic Todo density containment test `chatgpt/858-interaction-containment-lab-20261018@3f5f8f34c1a0d681df7b356520b1d99d8e7a429f`, [CI #39070187878](https://github.com/carlers/mosaic-life-tracker/actions/runs/39070187878) SUCCESS. With 1000 same-day text tasks slow-online PWA Todo Home-ready p50 1679→1355ms under ephemeral CSS containment and 8/8 paired 1000-task runs faster across offline/slow-online; mixed/slower at 25 tasks. Fixed row size unsafe for photos/multi-line/Diary and not shipped. Calendar click→first Day View DOM p50 ~689ms at 1000 tasks, independent of Home readiness ~680ms (different build inputs vs accepted CI).

## Current isolated Calendar experiment
- Branch `chatgpt/858-calendar-day-click-lab-20261018` from exact dev, with only new diagnostic browser spec, nondeployable GitHub Actions workflow and this checkpoint. Production runtime and app version unchanged. All Appwrite calls held, synthetic owner account and IndexedDB tasks only.
- Same-binary controlled Calendar baseline vs ephemeral CSS `content-visibility:auto; contain-intrinsic-size:auto 56px` targeting ONLY the click-opened Day View rows. 25/250/1000 text tasks, offline/slow-online cached PWA, four interleaved repeats; first programmatic click→DOM, two-animation-frame proxy (NOT first presented pixels), row cardinality and first deep-scroll CDP touch hold/cancel on both 1000-task conditions.
- Experiment is a hypothesis: no new latency or correctness result claimed before workflow completion.

## Remaining scope and gates
- Analyze full run CI, per-pair p50/p90, failed assertions and geometry risks. No CSS shipped without realistic variable-height and Diary/shared/accessibility/drag proof. Audit distributed cached tasks, photos, cold/warm, delayed 401, account switching, phone/desktop installed device and real first tap. Full task-focused → stable Scratch Preview canonical/READY workflow for any evidence-supported runtime change and owner device acceptance; no dev/main/Production/1.0 without approval.
- Issue #858 OPEN, separate #936 security/privacy and #914 backend compatibility pre-1.0 gates.
