# Test consolidation — 2026-09-24

Goal: shorten the required gate by avoiding duplicate page loads, module setup, and
RxDB fixtures while retaining each distinct behavioral contract. No application code,
CI gates, shard counts, worker limits, caches, or production build policy changed.

## Assertion survival map

Paths below are relative to `tests/`. Removed test names are identified by their unique
opening phrase. Assertions are moved rather than replaced with snapshots or weaker mocks.

### Browser contracts

All destinations are in `e2e/interaction-contract.spec.mjs`.

| Removed standalone case | Retained destination and decisive assertions |
|---|---|
| `todo calendar-grid swipe advances the month...` | `todo calendar follows the finger before snapping months`: initial friend index 0 and September; during-drag displacement; final October and friend index 0. |
| `todo compact calendar has no gray card fill or border` | `todo compact calendar centers the active month...`: computed transparent grid background and 0px top border, plus existing centering, 35 cells, transparent selected cell, and white numeral. |
| `calendar keeps at most three full grids mounted...` | `calendar swipe moves the calendar...`: at most three mounted grids, before the gesture. |
| `active calendar exposes labelled grid...` | `calendar swipe moves the calendar...`: nonempty active title, visible named grid, seven headers, at least 28 cells, one current-date marker, before navigating away from the current month. |

Every remaining case retains a fresh Playwright page/context. Back stack, focus,
other gesture ownership paths, computed geometry, narrow-screen overflow, Axe, and
PostHog privacy scenarios remain separate and required.

### Conversations and unread counts

Destination: `react/ConversationsProvider.test.tsx`. Every scenario has its own
messages-only RxDB instance and cleanup. Ordinary scenarios consume both public hooks;
unread assertions check both their outputs. The rerender scenario retains separate
consumers and its React Profiler assertion.

| Original scenario(s) | Retained scenario |
|---|---|
| Provider unauthenticated state | `exposes empty state when there is no authenticated user` |
| Provider no friends/messages | `exposes empty state when there are no friends and no messages` |
| Provider friends without messages + useConversations empty state | `builds one conversation per accepted friend, with no messages yet` |
| Provider unread incoming + useUnreadMessages baseline | `counts unread incoming messages from accepted friends` |
| Unsent-message exclusion in all three files | `excludes unsent incoming messages from unread counts (regression: F3)` |
| Provider sorting + useConversations sorting | `sorts conversations with messages newest-first, then empty conversations alphabetically` |
| Provider unread-only performance regression | `does not rerender an unread-only consumer...` |
| Provider account switch | `resets conversations and unread on user switch` |
| useConversations grouping | `grouping: messages across two friends map to the correct conversation` |
| useConversations mixed unread/read/outgoing | `unread: incoming without readAt counts; read incoming and all outgoing do not count` |
| useConversations latest message | `last message: the most recent message (any direction) becomes lastMessage` |
| Loading transitions in both hook files | `both public hooks transition from loading to ready after the subscription emits` |
| useUnreadMessages non-friend exclusion | `unread incoming from a non-friend sender does not contribute to totalUnread` |
| useUnreadMessages all read/outgoing exclusion | `read incoming and all outgoing do not contribute to totalUnread` |

This reduces 20 cases in three modules to 14 in one; no shared mutable database is
introduced between cases. Both removed hook modules were already testing this same
provider rather than independent data implementations.

### Settings, Account, and Day View

| Original source | Retained destination |
|---|---|
| SettingsPageRelease (2 cases) | `components/SettingsPage.test.tsx`: version/control ordering and staged update feedback. |
| SettingsPageDataDeletion (2 cases) | Same suite: distinct destructive confirmation and up-to-date feedback. Confirmation now uses the real BottomSheet dialog rather than a mocked region. |
| SettingsPageAppearance (1 case) | Same suite: navigation to `/settings/screen`, with no Appearance dialog. PWA mock resets between all five cases. |
| LayoutPolish Home inset case | Existing Home gesture case in `components/MainLayoutSwipe.test.tsx`: no `pb-24`, exact bottom-nav/safe-area inset. |
| LayoutPolish Account logout and quote cases | `components/AccountPageSocialStats.test.tsx`: logout remains inside account content; quote and author remain absent. |
| PrimaryPageScrollOwnership | Same Account suite: no nested `overflow-y-auto`; the original friend-count case remains. |
| DayViewSheetRegression `prefers supplied inline task and category data...` | Existing `components/TodoListIntegration.test.tsx` case `renders the loaded category and task through the real inline Day View surface`: actual supplied task/category text and inline surface render while fallback hook arrays are empty. The removed mock only rendered `Open actions` for any nonempty task list, so fallback data also satisfied it. |

## Verification repairs

- `scripts/verify-focused.mjs` delegates lint/broad selection to the small pure
  `planFocusedVerification` helper. Only existing paths reach ESLint. Broad-gate
  selection retains deleted paths; Vitest still receives the original diff base.
  `unit/verifyFocused.test.ts` covers existing, deleted, and renamed paths using
  real temporary files, including broad intent from a missing Vitest config.
- `components/HomePageSearchFlow.test.tsx` formats the selected date as a local
  calendar date. The prior UTC conversion displayed September 23 for local
  September 24 in Asia/Manila. Product date parsing is unchanged.

## Results

- Local `CI=true TZ=Asia/Manila npm run verify` passed: contracts, discovery,
  lint, 594 Vitest tests, production build, service-worker policy, and size budgets.
- Test discovery: 93 files = 37 unit + 7 handler + 49 DOM. Case count is
  599 − 6 messaging duplicates − 1 Home inset duplicate − 1 weak supplied-data
  smoke test + 3 focused-verifier regressions = 594.
- Browser baseline: 27 cases (14/13 across shards); consolidated: 23 (12/11).
  Both versions passed a warm-up plus three measured pairs, with no skips or retries.
- The date regression failed before the repair in Asia/Manila and now passes in
  that full gate. UTC full-suite benchmark results are recorded below.
- The first gate attempts rejected IDE `:line` suffixes in the copied session-prompt
  Markdown links; normalizing only those link targets fixed the documentation check.
- No application UI was changed; no additional device acceptance is required for
  this test-only consolidation. Existing manual OS Back/device limitations remain.

### Matched local timings

Environment: Linux x64, Node 22.22.2, 24 reported CPUs, Vitest 3.2.7 capped at
four workers, Playwright 1.58.2/Chromium 1208, UTC. Before/after use the same
installed application dependencies and machine. The baseline application/test
revision is `fe44f8e`.

| Metric | Before median | After median |
|---|---:|---:|
| Full Vitest wall time (three runs) | 15.83s | 15.52s |
| Browser completion: two simultaneous one-worker shards | 22.13s | 21.15s |
| Summed browser shard wall time | 38.81s | 36.47s |

Full Vitest wall time improves about 2.0%, a small difference within ordinary local
run variability. The after series ran without concurrent test/discovery processes.
Raw Vitest runs: before 15.70s, 15.97s, 15.83s; after 14.67s, 15.52s, 15.52s.

Browser completion improves about 4.4%; summed local shard runtime improves about
6.0%. These are local measurements, not GitHub billable runner minutes. The same
warm Vite server served both concurrent shards; CI uses separate hosted runners.
Dependency installation, checkout, caches, dev-server startup, and queue time are
excluded. Hosted CI completion and total runner usage after this change have not
been measured because no commit/push was requested.

Raw browser measured pairs (completion / summed shard seconds):

- Before: 22.164 / 38.846; 22.103 / 38.751; 22.129 / 38.811.
- After: 21.038 / 36.085; 21.154 / 36.475; 21.416 / 36.833.

Reproduce Vitest measurements with
`TZ=UTC npm run test:benchmark -- --suite full --runs 3`.
For browser measurements, prepare the pinned packages/Chromium, start Vite with
`VITE_POSTHOG_TOKEN=browser-contract-token VITE_POSTHOG_HOST=https://posthog.test`,
and run both `CI=true TZ=UTC npm run test:browser-contract -- --shard=N/2`
commands concurrently against `https://127.0.0.1:4173`. Time each process and the
pair; discard one warm-up pair and take the medians of three subsequent pairs.
Use separate Playwright output directories for simultaneous shards.
