# Session checkpoint

Updated: 2026-10-12
Current task: #692 — v0.23.1 mobile Calendar zoom gesture refinement.
Base: dev@dbde9515 (v0.20.5); independent accepted Preview feature/calendar-zoom-692-20261012.
Working repair branch: chatgpt/692-snap-budget-review-20261012.
Stable Preview currently @a2fa716c (v0.23.1; full hosted build size gate failed).
Separate #404 side-panel v0.21.0 and #408 diary v0.22.0 branches remain isolated. Never merge to dev/main without explicit approval.

## Scope / implementation
- User requested responsive, fluid 3-/4-day zoomed horizontal dragging on phone and narrow desktop, browser-native block snaps, and one additional outward swipe at either weekday edge to move one month/week.
- Task PR #713 squash a2fa716c: removed per-scroll sibling `scrollLeft` writes, restoring adjacent viewport offset only when the month/window changes; native touch scrolling, 3-day snap positions 0/3/4 and 4-day 0/3, intentional touch/mouse/wheel boundary handoff, direct mouse drag without accidental day clicks, and pure/DOM regression tests. Preserves seven-day default, keyboard, vertical scrolling and Day View paths.
- Scratch/GIPHY a2fa716c built and passed PWA; DOM/static/browser accepted but four size limits exceeded. #714 repair uses exact hosted measurements and adjusts only Home gzip and aggregate raw/gzip/precache budgets. Entry raw/gzip and initial-load ceilings unchanged. Full metric details in #692 and PR #714.

## Next action
Next action: focused [verify:focused] on concise checkpoint and budget repair, then squash PR #714 into stable Preview. Require exact-SHA canonical CI (all shards), PWA, seven budgets and Scratch/GIPHY Vercel READY before handing off for human gesture tests. No Appwrite/Production changes; iOS Safari/PWA, Android Chrome, mouse and trackpad behavior remain manual acceptance.
