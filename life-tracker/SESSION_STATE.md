# Session state

Updated: 2026-09-24
Current task: Trim redundant tests while preserving coverage
Status: implementation and local acceptance complete; changes remain uncommitted.
Roadmap pointer: PLAN.md — test workflow optimization
Next action: review the completed diff and confirm commit. Hosted canonical acceptance/Preview require an authorized commit/push.
Blockers: none.

## Progress

1. **Done — audit and agree scope.** 599 Vitest tests / 98 files; 27 browser tests. UTC full-suite median 15.83s. Browser jobs were the critical path in Verify #308.
2. **Done — implement consolidation.** Browser 27→23 cases; messaging 20→14; six fewer DOM modules. All focused checks pass. Preserve unrelated root repomix-output.xml and concurrent root .gitignore edit.
3. **Done — assertion-survival map and evidence.** docs/TEST_SUITE_TRIM.md maps every removal. Five evidence rows recorded (3 existing-direct, 2 added-red-green); helper structural red and Manila behavioral red captured.
4. **Done — full verification and timings.** Local `CI=true TZ=Asia/Manila npm run verify` passed all stages. 594 Vitest cases across 93 files (335 unit, 55 handler, 204 DOM); UTC three-run after median 15.52s versus 15.83s before. Browser warm-up + three measured pairs pass before and after with no skips/retries: 27→23 cases, median local completion 22.13s→21.15s; summed shard time 38.81s→36.47s. Hosted timing remains unmeasured.
5. **Done — documentation and final checkpoint.** TEST_WORKFLOW.md links the assertion map, exact counts, timing method, and limits in TEST_SUITE_TRIM.md. Application source, dependencies, CI workflow, sharding, and build policy are unchanged. No commit or push requested. Root .gitignore is unrelated and must not be staged with this task.

## Working set

- `scripts/verify-focused.mjs`
- `scripts/lib/focused-verification.mjs`
- `tests/unit/verifyFocused.test.ts`
- `tests/e2e/interaction-contract.spec.mjs`
- `tests/react/ConversationsProvider.test.tsx`
- `tests/components/SettingsPage.test.tsx`
- `tests/components/AccountPageSocialStats.test.tsx`
- `tests/components/MainLayoutSwipe.test.tsx`
- `tests/components/DayViewSheetRegression.test.tsx`
- `tests/components/HomePageSearchFlow.test.tsx`
- `docs/TEST_SUITE_TRIM.md`
- `docs/TEST_WORKFLOW.md`

Deleted modules and their surviving assertions are mapped in TEST_SUITE_TRIM.md.
Temporary logs/reports are under `/tmp/mosaic-trim-*` and `/tmp/mosaic-browser-*`;
the dev server and browser session were stopped after verification.

## Test evidence review

Five rows: BROWSER, MESSAGING, DOM are existing-direct; FOCUSED and DATE are
added-red-green (one structural red for the new helper import, one behavioral red
for the Manila date representation). Focused checks and local acceptance passed.
No manual or skipped application behavior: production behavior is unchanged.
The initial gate attempts failed the project link checker on copied IDE `:line`
suffixes; normalized link targets repaired this documentation-only issue.
No judgment of overall suite sufficiency is made here.

## Prior task context

Responsive Settings work is present in current Git. Audit inspected successful canonical Verify #308 on 05aebf5141947e7788761bc81fb342586902606f. Prior session's remote-pending prose was stale; Preview deployment was not checked by this task.

## Active user prompt

Local file-link targets below omit IDE line suffixes so the project link checker can resolve them.

# Context from my IDE setup:

## Active file: life-tracker/docs/REMOTE_VERIFY.md

## Open tabs:
- REMOTE_VERIFY.md: life-tracker/docs/REMOTE_VERIFY.md
- BUNDLE_AUDIT.md: life-tracker/docs/BUNDLE_AUDIT.md
- ACCESSIBILITY_AUDIT.md: life-tracker/docs/ACCESSIBILITY_AUDIT.md
- SESSION_STATE.md: life-tracker/SESSION_STATE.md
- PLAN.md: life-tracker/PLAN.md

## My request:
PLEASE IMPLEMENT THIS PLAN:
# Trim redundant tests while preserving coverage

## Audit findings

The best opportunities are repeated browser page loads and duplicated DOM/database fixtures.

- **Current suite:** 599 Vitest tests across 98 files, plus 27 browser tests.
- **Local baseline:** all 599 pass under UTC; three-run median **15.83 seconds**.
- **Observed CI bottleneck:** browser checks, based on [successful Verify #308](https://github.com/carlers/mosaic-life-tracker/actions/runs/35984402983).

| CI job | Observed duration |
|---|---:|
| Browser shards | 56–58 seconds |
| DOM shards | 44–49 seconds |
| Static checks, unit and handlers | 47 seconds |
| Production build | 42 seconds |

These are timings from one warm-cache CI run. Savings require measurement after consolidation.

## Recommended changes

1. **Reduce browser tests from 27 to 23.**
   - Remove the duplicate Todo month-swipe scenario; retain its starting-state assertions in the stronger “follows the finger” test.
   - Fold transparent-background/border assertions into the existing compact-calendar layout test.
   - Fold calendar mounted-grid count and accessibility semantics into the calendar-swipe test, checking initial semantics before navigating.
   - Preserve isolated browser contexts, real gestures, computed-style assertions, Back-stack behavior, focus checks, and Axe coverage.

2. **Consolidate messaging coverage from three files into one.**
   - Combine `ConversationsProvider`, `useConversations`, and `useUnreadMessages` tests into **14 distinct scenarios instead of 20**.
   - Exercise both public hooks against shared scenario fixtures.
   - Preserve grouping, sorting, latest-message selection, all unread exclusions, loading transitions, account switching, and the separate unread-consumer rerender regression.
   - Continue creating and removing a database per scenario.

3. **Reduce repeated DOM setup without dropping behavior.**
   - Consolidate the three SettingsPage suites into one, retaining all five scenarios.
   - Move Account assertions from LayoutPolish and PrimaryPageScrollOwnership into the AccountPage suite.
   - Transfer LayoutPolish’s Home inset assertions into the existing MainLayout Home test.
   - This removes **six DOM test files** across these consolidations and the messaging consolidation.
   - Remove DayViewSheet’s weak supplied-data smoke test: it only checks “Open actions,” which also appears with fallback data. Keep the existing real Todo integration test that verifies the supplied task and category actually render.

4. **Fix two issues needed for reliable trimming.**
   - In [verify-focused.mjs](scripts/verify-focused.mjs), exclude nonexistent paths from ESLint arguments while retaining the complete change set for test selection.
   - In [HomePageSearchFlow.test.tsx](tests/components/HomePageSearchFlow.test.tsx), assert the local calendar date instead of converting it to UTC. The current test reproducibly fails in Asia/Manila and passes in UTC.

## Validation

- Record where each removed assertion survives.
- Test focused verification with existing, deleted, and renamed files.
- Run the date regression under UTC and Asia/Manila.
- Run discovery, contracts, lint, all Vitest tests, build, and both browser shards.
- Compare three-run before/after medians under matching conditions; report browser critical-path time separately from total runner time.
- Update test-workflow documentation and the session checkpoint after implementation.

## Defaults and boundaries

Prioritize faster completion while retaining distinct behavioral coverage. Keep the existing CI gates, shard counts, dependency caches, and fresh build installation. Preserve sync, authentication, authorization, deletion, and handler coverage.

No tracked files were changed during this audit. Discovery and contract checks passed; implementation savings remain unmeasured. No public application APIs or schemas need changes.

Next-task profile: Standard — 6/10 · ETA 30–45 minutes — consolidate fixtures and assertions, repair the two verification issues, and measure the result.

**Run:** task=test-suite-audit · telemetry=off
**Handoff:** Implement this plan against current Git; SESSION_STATE.md still describes the prior task.
Migration: npm run handoff -- chat-implement
