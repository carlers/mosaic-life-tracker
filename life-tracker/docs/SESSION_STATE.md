# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 continued cached Calendar/Todo startup audit, diagnostic-only experiment.

## Verified baseline
- Accepted v0.29.8 Preview `7429dab8b5a9f553e66cbb699d9b2beb1ac42cb7` merged through PR #949 to `dev@bfb0fff0c1c283f599f32db8c2a426416fa65e7b`, with exact matching tree, successful canonical CI and ready dev Vercel deployment. No main/Production promotion. The issue remains open; see latest issue checkpoint #6240748328.
- Prior synthetic cached-PWA 2x CPU, slow-online median Calendar 0/25/500/1000 tasks: 290/295/381/531ms, Todo 326/432/845/1261ms. Results are not physical-device SLAs.
- Source review: default Calendar renders day-cell TaskBlocks and local `useTasksByDate` grouping; Todo's inline DayViewSheet mounts full task DOM/Framer Motion structures and nearby-only dnd-kit registrations. No evidence yet that skipping offscreen browser layout would improve user interactions.
## Current isolated work
- `chatgpt/858-interaction-containment-lab-20261018` from verified dev; diagnostic-only browser spec and push-scoped Actions job. Version and runtime application files unchanged. All Appwrite requests held during synthetic measurement, no real user/backend data.
- Compare 25/250/1000 locally seeded same-day tasks across Calendar, unchanged Todo and ephemeral Todo-only CSS `content-visibility:auto` containment; slow-online/offline, four interleaved repeats, first programmatic click-to-DOM response, Home phase marks, long tasks, DOM counts and deep-row touch hold. Reject significant correctness regressions or meaningless performance gain. First-click proxy is not physical touch latency. These are **planned measurements**, not passed evidence.
## Constraints and next
- Inspect exact GitHub Actions result and report artifact for this branch. If test fails, determine root cause and repair. Record measured outcomes in issue #858; do not ship CSS if unsafe or unsupported.
- Follow with realistic date-distributed/photo/Diary/shared and account-boundary coverage; preserve first gestures, cross-category drops and accessibility. New runtime changes require focused tests, full canonical and trusted Scratch Preview READY, plus device acceptance before any promotion. Keep issue #858 OPEN; no further dev/main/Production/1.0 authorization. Independent gates #936 and #914 remain open.
