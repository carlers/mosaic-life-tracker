# Test suite audit — 2026-09-22

Scope: all repository tests under `life-tracker/tests/**` on the Todo TDD repair
checkpoint: the 69-file Vitest baseline plus the repository Playwright contracts and
their browser harnesses/helpers. The audit then added one Todo integration test file to
close the identified mock-boundary gap.

## Audit standard

Tests were reviewed against Mosaic's authoritative product/architecture contracts and the
test workflow, not against whether they happen to match the current implementation.
A strong test asserts observable behavior, protocol invariants, semantics, or a documented
structural contract. A weaker test primarily mirrors implementation details, mocks away
the component that owns the behavior, or verifies source text without that source text
being the contract itself.

## Findings

The suite is predominantly behavior/contract oriented. Unit sync/mapping/outbox tests pin
protocol outcomes and failure semantics; Appwrite handler tests pin request validation,
authorization, pagination, write ordering, and response behavior; React/provider tests pin
observable state transitions; component tests mostly use accessible roles/actions; and
browser contracts own real history, touch/carousel, layout-overflow, accessibility, and
PostHog browser behavior.

No snapshot tests were found. Source-file inspection is not a general testing pattern; the
notable `workflowDocs.test.ts` case intentionally reads documentation because the
documentation wording/requirements are the behavior under test.

The main weakness is **mock-boundary blindness in UI tests**. In particular,
`TodoListView.test.tsx` mocked `DayViewSheet`, while
`DayViewSheetRegression.test.tsx` mocked `DaySlide`. Those tests correctly verified
wiring but could not prove that Todo's actual selected-day category/task UI rendered as one
cohesive page. That gap allowed the earlier Todo regressions to pass DOM verification.
A real Todo integration test now crosses that boundary, while Playwright pins direct
manipulation, day tapping, nested-scroll ownership, friend-carousel isolation, and narrow
viewport overflow.

A few tests are necessarily more structural:
- calendar/chat overflow tests assert CSS overflow classes because scroll ownership is a
  documented interaction contract;
- build/service-worker/workflow tests inspect generated or repository structure because
  that structure is the explicit policy;
- high-mock page tests such as `ChatPageLayout`,
  `PersonPaneViewSwitcher`, and `DayViewSheetRegression` remain useful focused wiring
  tests, but should not be treated as sole acceptance evidence for behavior crossing those
  mocked boundaries.

## Policy adopted

For new features, behavior changes, and bug fixes, Mosaic now uses spec-first TDD when
practical: write the acceptance assertion from the governing spec, demonstrate a meaningful
red state, implement, make the focused test green, then use the full suite as the regression
gate. Cross-component UI requirements need at least one non-mocked integration or browser
acceptance layer.

The Todo repair itself demonstrates this policy. The acceptance tests were committed before
the implementation and failed behaviorally on smooth calendar movement, cohesive scrolling,
and horizontal containment. The subsequent implementation is required to turn those same
requirements green.

## Ongoing audit rule

Do not chase line coverage or test counts as goals. When a regression escapes, ask first
which documented behavior lacked a decisive acceptance assertion or which mock boundary
hid it, then add the smallest spec-derived test at that boundary. Existing broad suites
remain valuable regression checks after the focused test is green.
