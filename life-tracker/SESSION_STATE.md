# Session state

Updated: 2026-09-23
Current task: Todo calendar layout correction and top-level page swipe navigation
Status: in progress.

## Active user prompt

> the calendar is still off center. the selected day should put a white circle around the day number not the entire cell. only have 6 cell rows on months where necessary, dont enforce same height for all, i was mistaken. implement swiping across pages, home explore, notifs, chat, me. swipinf right on me page opens settings. ensure theres drag gesture and its smooth not janky. swipe area for home page to explore is the hamburger layer

## Progress

1. **Done — recover Preview baseline and rules.** Confirmed Preview at `b05676e2c661e86c84f9b8e9b43562d43051652a`; read current agent, session, roadmap, product, remote verification, and test workflow guidance.
2. **Done — inspect navigation and calendar implementation.** Todo currently forces 42 cells and fills the whole selected cell; the screenshot's edge bleed is consistent with neighboring Embla slide content not being paint-contained. Primary routes are owned by AppLayout/MainLayout; Home already has nested person/calendar swipers, so the route gesture must be restricted to its top menu row. Individual chats must remain outside route swiping.
3. **In progress — spec-first regression coverage.** Updated §2 to natural month rows, number-only selection, centered/no-bleed Todo geometry, and primary route swipe ownership. Added focused tests for September's five-week grid, selected-number ring, route mapping, Home hamburger-layer-only gesture, and Me right-swipe. Next checkpoint is the expected red focused run before implementation.
4. **Pending — implement calendar/layout corrections and shared route swiper.** Preserve bottom-nav semantics and OS/browser navigation; keep editable controls/nested carousels from leaking gestures to route navigation.
5. **Pending — focused browser verification.** Use focused Vitest plus browser contracts during iteration; fix any regressions without paying the full gate on each repair.
6. **Pending — final acceptance and Preview rollout.** Run one `[verify:full]` exact-commit gate, move Preview only after green, and confirm hosted deployment.
7. **Pending — handoff closeout.** Report commits, verification, deployment, and remaining physical-device swipe/visual checks.

Roadmap pointer: navigation interaction follow-up + Todo List visual correction.
Blockers: None.
