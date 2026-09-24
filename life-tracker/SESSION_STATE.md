# Session state

Updated: 2026-09-24
Current task: Large-screen content/sheet width settings and Settings child-page navigation
Status: implementation started on `chatgpt/large-screen-layout-settings`.

## Active user prompt

> go

## Approved scope

The user approved the immediately preceding design discussion:
- Add a real Screen settings page at `/settings/screen`.
- Keep Appearance choices on that page.
- Add Content width: Full screen / Comfortable.
- Comfortable applies on tablet/desktop only and uses approximately `min(70vw, 960px)`, centered; phones remain full width.
- Add Bottom sheets: Full width / Compact.
- Compact sheets are centered and approximately 540px max on larger screens; phones remain full width.
- Persist both choices through the existing synced settings system.
- Reuse the existing appearance/settings provider so the shell and BottomSheet share one settings subscription.
- Make Settings child pages support right-swipe back to Settings with live attached-page preview; Profile participates as a Settings child.
- Preserve Settings right-swipe back to Me.
- Keep the primary bottom-nav swipe chain unchanged.
- Apply width behavior globally through shared layout/sheet primitives rather than page-specific patches.

## Progress

1. **Done — recover rules and current implementation.** Read AGENTS.md, SESSION_STATE.md, PLAN.md, remote/test/preview workflow docs, PROJECT_REFERENCE §2/§7/§13, and current AppLayout/MainLayout/BottomSheet/Settings/Profile/appearance/swipe implementation.
2. **In progress — add red regression coverage for Screen route, layout preferences, compact sheets, and Settings-child swipe navigation.**
3. **Pending — implement synced display-width preferences and Screen page.**
4. **Pending — implement global content-width and BottomSheet-width behavior.**
5. **Pending — generalize parent-route swipe-back with live preview for Screen/Profile while preserving Settings→Me.**
6. **Pending — focused verification, repair, evidence review, exact final full acceptance.**
7. **Pending — fast-forward Preview and verify Preview guard + Vercel; provide manual iPad/desktop/touch protocol.**

Roadmap pointer: responsive layout / settings UX.
Blockers: none.
