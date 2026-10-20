# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #856 — final touch release near edge + cross-day settling overlap.

## Owner feedback and live state
- v0.34.6 Preview generally works, but on physical phone releasing near edges (or even inside a category) can occasionally leave the task overlay floating while edge timers continue swiping; cross-day settling visually overlaps existing target-day rows rather than matching native same-day reorder.
- Source baseline: stable Preview `feature/cross-day-drag-856-20261020@b4df879cb66ee630d572c4df39b95841fcab7fe8` v0.34.6, full canonical #39442591604 success, exact-sha Vercel ready. `dev@0606ff3aebf565cd47f1fe9bc4e53cf64a1499a0` separate. Issue #856 open, no dev/main/production approval.
- Proposed v0.34.7 PATCH. Task branch `chatgpt/856-touch-release-settle-20261020`.

## Root cause and scoped fix
- Previous hook explicitly ignored `pointerup` on physically held touch once a touch identifier existed. If mobile WebKit's final `touchend` never bubbles to the window and detached touched task doesn't receive it reliably after Swiper virtualized/unmounted it, no terminal event clears the carried overlay or repeat swipe dwell/cooldown timers. Treat exact matching `pointerup` as a definitive release for touch **and** mouse, even when touchend is unavailable; the existing original touch target/window touchend remains the fallback. Stop timers, remove overlay, ignore subsequent duplicate touch terminal callbacks.
- Old `finish()` removed both dragged overlay and neutral destination insertion space *before* awaiting the persisted task move. This caused the incoming destination task to FLIP/interpolate over siblings while gap/categorical projection collapsed in a separate frame. Preserve a `settling` destination projection (source task masked, neutral slot reserved) after hiding the floating overlay; clear only after async commit and two render frames, with 2.5-second safety fallback, revision token and cleanup on close/new drag. Native DnD and Swiper interaction remain disabled during that short gap handoff, then resume. Preserve no colored gap or success toast.
- Test real browser/CDP touch releases at right edge and inside populated destination category; verify no ghost overlay, no further day advancement after 1.2s, non-overlapping settled rows, and separately emulate matching pointerup without touchend. Existing cancellation, repeated swipes, browser mouse, live category motion and same-day reordering remain covered.
- No backend/schema/service changes. Failure feedback stays, success toast remains removed.

## Verification and delivery
- Run task browser-focused gate, repair if red, squash to stable Preview, run canonical all-shards build gate, then exact-SHA registered Vercel Preview READY. Publish per-issue checkpoint.
- Owner Android/iOS physical device acceptance, extreme >87-day Swiper rebase, offline storage/sync and actual save/settling smoothness remain manual checks. Keep issue open.
- Do not merge to dev/main/production without explicit owner approval.
