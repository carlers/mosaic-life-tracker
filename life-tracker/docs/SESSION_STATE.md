# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #851 — correct category-pill bulk selection to Select mode only, v0.29.1 Preview refinement.

## Verified baseline
- `main@bb58300052dc4c85974d97779e2b257ec4f28c7d` Production v0.17.4 and `dev@6d488d3c3b2ae0e998162d4fe70303fdfa58b964` v0.26.2 remain protected and unchanged by this task.
- #851 first CI-first user-testable v0.29.0 `feature/category-day-select-851-20261015@2057f577920538336710cb16e6db34f6c5eb4696` full canonical #38707710335 SUCCESS attempt 3, trusted delivery #38708524164 SUCCESS and one CLI Preview READY `dpl_2tTc92HyotdXrKKQ2E3vZuwMC5Wd`. User clarified that direct pill selection without first entering Select mode is wrong. The first Preview is not accepted.
- #592 trusted receiver on main and byte-exact generic source-side Git suppression on this stable branch remain active; do not bypass exact artifact attempt checks. #852 has separate acceptance/promotion gates.

## Correct behavior
- **Outside Select mode** the entire category pill stays the original Add Task control (no independent selection action or split +/- click targets).
- **Inside Select mode** the entire pill selects all active-day owned nondeleted tasks in its category, then toggles them off on the next tap while preserving other categories' selected tasks. The original Select button must be used to enter the mode.
- Preserve existing local day/account/category scoping, inactive Swiper guard, backlog restrictions, task-level selection and all unrelated UI. No backend, schema, Production or protected promotion change.
- Add regressions explicitly proving outside-mode add / no selection and after-entering-mode category selection. Stamp v0.29.1 PATCH because v0.29.0 was already published as a testable Preview.

## Next action
Run task-focused CI, repair failures if any, then squash via protected PR to the existing first-commit CI-suppressed #851 stable branch. Require exact full canonical acceptance and one trusted CLI Preview READY; get owner device acceptance before any stable→dev promotion. Do not auto-close #592/#851.
