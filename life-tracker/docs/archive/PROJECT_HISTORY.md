# Project history through 2026-09-24

Historical record; current contracts are in [the reference](../PROJECT_REFERENCE.md).



| Date | Title | Sections | Summary | Pointer |
|---|---|---|---|---|
| 2026-09-15 | Auth context single source of truth | §4, §8, §9, §10, §15, §18, §19, §23 | `AuthProvider` owns session; `useAuth` shim; `logout()` returns boolean; global 401 event; multi-tab broadcast; offline retry screen; sync after login | §23 |
| 2026-09-15 | Auth lifecycle closure | §9, §10, §15, §18, §23.4–23.7 | `guardedCall` centralizes 401 dispatch; `isUsernameAvailable` returns null on 401; retry + backoff; changelog added | §23.4 |
| 2026-09-15 | Revision workflow tooling | §5.1 (new), §15 | Mega-file + `apply-changes.mjs` installer with backup/lint/build/rollback | §5.1 |
| 2026-09-15 | Tilde outer fence + local-dirty-wins | §5.1, §18 | Outer fence switched to tildes; length-matched closing; inner backticks inert; local-dirty-wins documented | §5.1, §18 |
| 2026-09-15 | Backlog cleanup | §4, §8, §9, §20.3, §20.5 | Scope annotation; phase reorder; legacy peer cross-ref; read-receipt cadence | §20.5 |
| 2026-09-16 | Backlog closure follow-up | §6, §8, §10, §11, §15, §18, §20.3, §20.7, §21, §23.4, §23.7 | Fence-aware parser; `Parameters<T>` trap; `msg_` guard; `makeUnauthorizedError`; `sdk.ts` guarded surface + ESLint; bounded loops; two-phase read-then-write; reaction timeout toast; ChatPage poll 30s | §5.1, §6, §18 |
| 2026-09-16 | Read-receipt worst-case correction | §20.5 | Corrected to 90–120s (30s poll + 60s backoff cap); keep code, fix doc | §20.5 |
| 2026-09-16 | Calendar rendering pipeline | §16 | Slide windowing; `tasksByDate` Map; memoized day arrays/`DayCell`/`CalendarBody`; friend refetch throttle; ref-counted `useTaskImage`; manual windowing | §16 |
| 2026-09-16 | Fence-rule rewrite | §5.1 | 4-tilde outer vs ≤3 inner; pitfalls subsection | §5.1 |
| 2026-09-16 | Mounted pane freshness | §18 | Refetch on activation with minimum interval; `PersonPane` reference | §18 |
| 2026-09-16 | Calendar perf dead-code removal | §8, §15 | Marked complete; removed `CalendarView`/`ViewContainer`/`DiaryView`/`TodoListView` | §8 |
| 2026-09-16 | Test Suite Layers 1–4 | §5.1, §8, §10, §12, §15, §24 (new) | 152 tests, 3 projects; installer runs `npm test`; `allowEmptyCatch`; §24 layout/philosophy/helpers | §24 |
| 2026-09-16 | Test Suite Layer 5 | §8, §15, §24 | Components project (happy-dom + RTL); totals 211/26/4 projects | §24.2 |
| 2026-09-16 | Conversations / unread audit | §8, §9, §15, §16, §24 | `ConversationsProvider` + `FriendsProvider` own subscriptions; thin selectors; `ConversationRow` memo; `isUnsent` excluded; F11–F13 invariants | §16 |
| 2026-09-16 | Sync engine audit (13 slices) | §6, §8, §10, §12, §15, §18, §20.5, §20.7, §24 | Listener isolation; dirty boundary at cycle-start; state versioning; page cap; user-scoped lastSync; server-owned `read_at` before dirty-skip; `_meta.lwt` re-check; `createRow` 404; Web Locks; `messageActionQueue`; drift detection; D6 `updatedAt`; `SyncStatusSheet`. Accepted limitations D1/D3/D7/F9-backoff | §18 Accepted Limitations, §20.5 |
| 2026-09-16 | Sync Status UI (F16) | §8, §10, §15, §24 | `SyncStatusSheet` surfaces `SyncStatus.errors` via Settings; only user-visible sync-error surface | §10 |
| 2026-09-16 | Offline write resilience outbox | §10, §15 | `socialOutbox.ts` retries reciprocal friendship + profile writes; permanent drops emit failure events; `getCurrentUserId` distinguishes 401 from offline | §10, §15 |
| 2026-09-17 | AGENTS.md compression | all | §0 hard rules and index-style changelog established; section prose compressed by about 25% | §0, Git history |
| 2026-09-17 | §0 dedup follow-up | §0 | Merged former rules 2 + 10 into one; §0 is now 9 rules grouped by action (schema → sync → messaging → cross-user → auth → tooling) | §0 |
| 2026-09-19 | Portable AI workflows | §5, §25 | Codex and DeepSeek shared neutral state; compact role packets replaced mandatory repository exports; full-file installer retained | Git history |
| 2026-09-20 | Capability-based AI workflows | §5, §25 | Workspace agents and provider-neutral web chats share rolling checkpoints, generic handoffs, and mid-batch recovery | `docs/AI_WORKFLOW.md`, `docs/AI_WORKFLOW.md` |
| 2026-09-20 | Phase 4 contract discoverability | §0.1, README, AGENTS | Added concern-based contract index, structural reference checker, and verify-gate enforcement for authoritative project docs | `scripts/check-project-contracts.mjs` |
