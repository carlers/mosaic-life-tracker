# Session checkpoint

Updated: 2026-10-23 UTC
Current task: #1027 / #1029 reconcile latest dev personal UI into isolated Supabase Preview, enable private Diary only after hosted migration/privacy acceptance.

## Source boundary
- Isolated stable baseline `feature/1027-supabase-recovery-20261020@4058478efe6a5cea33adaa660601d1a341ccc7c3` v0.44.0, all four canonical tests SUCCESS, protected Vercel immutable READY at `mosaic-life-tracker-p9qzyy5fs-carls-projects-72516fde.vercel.app`. No dev/main/Production writes.
- Reconcile the user-facing UI from pinned dev `ebc8614f379dcd7934316cd5c299d40ceae75e16` onto the isolated feature via task `chatgpt/1027-dev-ui-diary-reconcile-20261023`. Proposed Preview version v0.44.1; not yet accepted.
- Preserve Supabase Auth, signed owner authority, legacy Appwrite writer fences, native RxDB sync, category retirement and deletion behavior, local owner isolation, and core-only social/media/bucket-list denial. Do not overwrite provider-specific guards from dev.
- Adopt dev calendar/day layout, timeline, pinch zoom, task/category reorder, keyboard navigation, standard select, accent color controls, and personal uncompleted tasks. User-facing combined build requires Quality plus signed core/restore/browser acceptance.

## Diary blocker
- Source already contains `core-diary`, private owner CAS/RxDB pilot, migrations `20261022_candidate_private_diary_domain.sql` and `20261022_candidate_private_diary_realtime.sql`; deployed Preview is intentionally `core-only`.
- Read-only Supabase project inspection 2026-10-23 shows no hosted Diary table/migration. Never change build flag alone; independently encrypted snapshot and isolated restore, reviewed hosted additive migrations, signed two-owner/RLS/diary/offline CI, then protected READY must pass before UI Diary can be enabled.
- Hosted advisor warns four private-schema tables lack RLS; separate privilege grants previously verified deny anon/auth schema/table access. Do not silently grant public access or apply unreviewed fixes.

## Next action
- Review scoped graft diff from dev, feature-specific bridge files and v0.44.1 stamp, then task focused CI; repair diagnostics. After green, squash only to isolated feature, run full four canonical exact-SHA tests and protected reviewer-approved immutable Preview.
- User will test representative mobile/calendar/dayview/Diary + two-device sync AFTER verified Preview. No actual Appwrite↔Supabase data cutover; historical Appwrite source/old-PWA writer cutoff not ready.
