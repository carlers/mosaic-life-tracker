# Session state

Updated: 2026-09-24
Current task: Home task search with category/date filters and Day View navigation
Status: planning approved; implementation starting on `chatgpt/home-task-search`.

## Active user prompt

> put icons for tasks with memo or image so user can differentiate in the search. everything else approved. now go impelment it and be smart

## Approved behavior

- Add a Search icon beside the Home hamburger; tapping expands/focuses a Home-owned search bar.
- Search stays on Home and covers the signed-in user's tasks only.
- Search is local/offline over the existing live task/category data; do not add server search or a duplicate always-on subscription.
- Match task titles case-insensitively; support multi-category filtering plus Any date / Today / This week / This month / custom range.
- Results show task title, category/color, date, completion state, plus memo/image indicators when present.
- No query + no filter renders a prompt instead of every task. Filters alone may return results.
- Rank prefix matches before substring matches, with today/future dates ascending then past dates newest-first. Bound rendered results.
- Tapping a result opens the existing DayViewSheet on that date and focuses/highlights that task.
- Closing DayViewSheet by Back or downward header drag returns to the preserved search state.
- Search close clears query/filters. DayView open/close preserves query, filters, and result scroll position.
- Keep animations smooth, reduced-motion aware, and avoid per-keystroke DB/network work or per-frame React state.

## Progress

1. **Done — recover current Preview state and governing guidance.** Read AGENTS.md, SESSION_STATE.md, PLAN.md, REMOTE_VERIFY.md, relevant PROJECT_REFERENCE sections, and inspected Home/PersonPane/DayViewSheet/BottomSheet/route-swipe/task/category architecture.
2. **Done — product alignment.** User approved the proposed UX/performance plan and added memo/image indicators to search results.
3. **In progress — implement shared owner data + Home search surface.** Next: add search/filter/ranking helpers and Home UI without duplicate task/category subscriptions.
4. **Pending — DayView deep-link/focus integration.**
5. **Pending — regression tests and test-evidence review.**
6. **Pending — focused verification, full acceptance gate, repair failures.**
7. **Pending — move Preview to the exact full-green task commit and verify deployment/status.**
8. **Pending — concise completion checkpoint.**

Roadmap pointer: Home interaction/search enhancement.
Blockers: none for this task. Historical GitHub branch deletion remains blocked by connector capability.
