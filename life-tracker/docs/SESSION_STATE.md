# Session checkpoint

Updated: 2026-09-28

Current task: TodoMate → Mosaic migration is live-accepted on stable Preview branch
`feature/todomate-importer`.

Status: the importer and its CORS regression fix are delivered to
`feature/todomate-importer` at `0f1c4e692b7f4d8192d9d5356c32a453b90f1287`.
Full stable-branch Quality Gate 1269 passed and the Vercel Preview was READY. The user then
completed a real-account preview and import successfully.

## Accepted live result
- Preview found 505 TodoMate tasks, 13 categories, and 1 diary entry.
- 3 undated TodoMate tasks were explicitly reported and placed on the local import day,
  matching the documented Mosaic date requirement.
- 37 TodoMate task photo attachments were explicitly reported and skipped, matching the
  documented first-version limitation.
- The user completed **Import into Mosaic** successfully.
- The migration remained Merge-only through Mosaic's existing restore engine.
- TodoMate credentials/tokens were not supplied in chat and remain outside Mosaic's backend.
- The CORS compatibility fallback uses only TodoMate's public Firebase web configuration;
  authentication and personal-data reads still go directly browser → Google/TodoMate.

## Delivered migration behavior
- TodoMate is read-only.
- Full owned `Goal`, `TodoItem`, and `Diary` history is previewed before Mosaic writes.
- Groups/categories, task history/completion state/time, memos, reminders, routine
  references, and diary data map into Mosaic.
- Newer Mosaic rows/tombstones win because application is Merge-only.
- TodoMate task photos are not copied in v1 because Mosaic requires owned Appwrite Storage
  file IDs.
- Routine IDs are preserved on tasks, but TodoMate recurring routine definitions are not
  reconstructed in v1.
- Selected-viewer TodoMate visibility narrows to private rather than broadening access.

## Verification
- Runtime adapter/UI coverage pins direct Google/TodoMate network boundaries, owner-only
  history queries, mapping/warnings, bad-login behavior, password clearing, Settings
  discoverability, Merge-only restore, and the Firebase-config CORS fallback.
- Exact task SHA `6b903a82c76a6c47ff74d5adb51e621a9176d108` passed full Quality Gate 1268.
- Stable Preview SHA `0f1c4e692b7f4d8192d9d5356c32a453b90f1287` passed full Quality Gate 1269.
- Hosted real-account manual acceptance passed.

## Remaining TodoMate work
- No blocker remains for the first-version TodoMate migration.
- Stable Preview promotion to `dev` remains a separate explicit user decision.
- Photo attachment migration and recurring routine-definition reconstruction are future
  enhancements, not incomplete acceptance criteria for v1.

## Separate DR follow-up
- DR work is already merged into `dev`.
- Production `dr_backup` is live at `0 11 * * *` with the accepted read-only deployment.
- External GitHub stale-backup monitoring still requires default-branch delivery/configuration;
  do not promote to `main` without explicit user authorization.

Next action: finish this acceptance-documentation delivery into
`feature/todomate-importer`. Then wait for explicit instruction before promoting that
stable Preview branch to `dev`.
