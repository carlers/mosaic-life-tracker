# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #857 historical category retirement / destructive category-and-tasks deletion, coordinated with #1029 private Diary and #1027 public Supabase release.

## Baseline
- Isolated stable Supabase core+Diary foundation at `feature/1027-supabase-recovery-20261020@4479983878e4129a46936683352270752c503603` contains SQL-only private Diary domain (#1029). The exact-SHA full Quality Gate #39650558703 succeeded; signed lab #39650558595 still pending at this task start. No Diary client writer/UI flag or hosted Diary migration.
- The owner reports near-instant two-device task/category sync on protected v0.32.5 Preview. Current Supabase Auth remains invitation-only. Two old owner tasks are still orphaned from historical deletion in `mosaic-dev`, untouched.
- Explicit current release scope: public self-registration, tasks/categories/calendar/backlogs + owner-private Diary. Social, chat, alerts, sharing and images are deferred. Current `dev` and `main` are significantly newer Appwrite branches; no direct merge or Production/provider cutover authorized before exact upgrade + DR/reversibility.

## This task branch
- `chatgpt/857-category-retirement-contract-current`, starts at accepted isolated `44799838...`, proposes **v0.33.0** user-testable feature Preview, not Production.
- Adds `retiredOn` date-effective metadata with RxDB categories schema v2 migration; signed Supabase category mapping and CAS patch allowlist; additive guarded `retired_on` column + narrow owner-only category CAS extension installed in disposable Core App Lab (NOT yet hosted).
- Category lifecycle helper and behavior tests preserve inclusive historical date category and original task IDs; after retirement, empty category hidden on future dates, existing future/undated tasks remain visible and editable but not a new task destination.
- DaySlide projects category rows by actual date; CategorySection disables adding when only future legacy tasks remain. CategoryManager offers Retire (date picker) / Restore and an independent destructive Delete category AND all tasks, requiring exact typed name and counting active tasks on all dates/Backlogs.
- Destructive Delete tombstones live owner-scoped task rows first, then category; failed/partial tasks leave category live for retry. No auto-reassignment or direct physical deletion. Privacy inheritance stays attached to unchanged category IDs.
- New/updated source tests must pass; signed two-owner migration, offline conflict and cross-device consent-based acceptance are still required. **No hosted mutation, Preview, dev/main or Production promotion** in this source branch.

## Next action
- Focused Quality Gate on this branch, correct any TS/schema/test faults; squash to isolated stable only when green, then exact-SHA canonical + signed Supabase lab.
- Review category deletion race with concurrent remote creations; add server-enforced protection/transaction if needed before public access. Recover two legacy orphaned task rows only under explicit owner-approved procedure.
- Complete #1029 Diary signed mapping/transport/RxDB runtime and privacy tests; only then enable Diary and stage public Auth signup gate change behind abuse controls, backup/restore, platform/PWA testing and explicit release approval. Keep current Appwrite provider reversible.
