# Session checkpoint

Updated: 2026-10-12
Current task: #692 — v0.23.2 daily snap and safe month transitions.
Baseline: stable feature/calendar-zoom-692-20261012@ac7d17e (accepted v0.23.1).
Current Preview revision: feature/calendar-zoom-692-20261012@4cd765d v0.23.2 (build guard failed only).
Working repair: chatgpt/692-day-snap-build-budget-20261012.

## Implemented
- Daily snap positions 0–4 (3 visible days) / 0–3 (4 visible days).
- On edge swipe, incoming next month/week prepositions left; incoming previous prepositions right. Outgoing scroll cannot modify incoming weekday offset while Embla animates; new horizontal gestures wait for settle.
- Mouse drag allows smooth scrollTo completion before mandatory CSS snap returns. Touch, trackpad, keyboard, natural vertical scroll and pinch zoom retained.
- Tests cover snap math, gesture lock, mouse behavior and next/previous period alignment. Task focused CI passed. Separate #404 and other feature branches untouched; no dev/main promotion approved.

## Build/checkpoint
- Stable v0.23.2 @4cd765d built & PWA passed but exceeded four tight Home/aggregate caps: Home 368577/368200, app raw 2469779/2468000, gzip 766702/766300, precache 2557086/2555200 B. Entry raw/gzip and initial-load bytes are identical to accepted v0.23.1 and pass.
- Repair narrowly reviews these four measured limits; evidence in budget config and #692. No backend/Appwrite or Production changes.

Next action: complete focused CI for budget-review repair; squash into stable Preview; require canonical Quality Gate (including browser shards), all seven size budgets, PWA and Scratch/GIPHY Vercel READY on exact SHA. Real iOS/Android touch, laptop mouse/trackpad, reduced-motion manual acceptance remains pending. Do not merge dev/main.
