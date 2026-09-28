# Session checkpoint

Updated: 2026-09-28

Current task: deliver a safe TodoMate → Mosaic personal-data migration after merging the
completed disaster-recovery work into `dev`.

Status: disaster-recovery branch `chatgpt/dr-restore-drill-authorized` was fast-forwarded
into `dev` at `70e2ca78bb610bc44b583e57c9fa5db99538ffef`; post-merge comparison was
identical. TodoMate migration work now lives on `chatgpt/todomate-importer`, created from
that exact `dev` tip.

## TodoMate migration implementation
- Settings exposes a dedicated **Import from TodoMate** bottom sheet.
- The importer retrieves TodoMate's public Firebase web configuration from
  `https://www.todomate.net/__/firebase/init.json`.
- TodoMate email/password are sent directly from the browser to Google's Firebase Identity
  Toolkit login endpoint. The password is kept only in sheet state and cleared immediately
  after the preview attempt; Mosaic stores no TodoMate refresh token or Firebase ID token.
- Authenticated reads go directly to TodoMate's Firestore project. The importer requests
  the signed-in account's complete owned `Goal`, `TodoItem`, and `Diary` records using
  owner-only filters rather than scraping a date range.
- TodoMate is read-only. No write/delete/social operation is sent to TodoMate.
- The adapter converts the read result into an in-memory Mosaic user-backup v2 file, then
  uses the existing `restoreUserData(..., mode: 'merge')` path. This preserves sync
  preflight, ownership checks, schema validation, deterministic cross-account IDs,
  idempotence, and newer-Mosaic-wins semantics.
- Goal title/color/order/visibility map to Mosaic categories. Task date/completion time,
  memo, reminder, and routine reference map to Mosaic task fields. Diary body/emoji and
  visibility map to Mosaic diary entries.
- TodoMate allows undated tasks while Mosaic currently requires dates. Preview reports
  these and places them on the local preview day instead of dropping them.
- TodoMate task photos are counted/reported but not copied in this version because Mosaic
  task images require owned Appwrite Storage IDs.
- Routine IDs are preserved on imported tasks, but recurring routine definitions cannot
  yet be reconstructed because Mosaic has no routine-definition collection.
- Selected-viewer TodoMate visibility imports as private rather than broadening access.

## Verification
- Unit coverage pins direct Google/Firebase network boundaries, owner-only full-history
  query shape, deterministic Goal/Todo/Diary mapping, undated/photo/routine warnings,
  bad-login no-read behavior, and missing-credential no-network behavior.
- Component coverage pins password clearing after preview, Merge-only restore, warnings,
  and Settings discoverability.
- Quality Gate run 1255 passed the runtime implementation/tests before documentation
  finalization. A final `[verify:full]` exact-SHA gate is still required after the
  checkpoint/docs are complete.

## Relevant files
- `src/lib/todomateImport.ts`
- `src/components/modals/TodoMateImportSheet.tsx`
- `src/pages/SettingsPage.tsx`
- `tests/unit/todomateImport.test.ts`
- `tests/components/TodoMateImportSheet.test.tsx`
- `tests/components/SettingsPage.test.tsx`
- `docs/TODOMATE_IMPORT.md`
- `docs/PROJECT_REFERENCE.md`
- `docs/PLAN.md`

## Remaining
1. Complete final exact-SHA canonical acceptance.
2. Deliver the accepted task branch through a stable `feature/*` Preview branch per
   `docs/DELIVERY.md`.
3. User performs live acceptance with their own TodoMate credentials locally/in Preview:
   verify preview counts, run the import, then spot-check historical completed/incomplete
   tasks, categories, memos, reminders, and diary entries after Mosaic sync.
4. Only after live acceptance should the TodoMate migration roadmap item be marked complete.

## Separate DR follow-up
- Production `dr_backup` is already live at `0 11 * * *` with read-only scopes and the
  accepted ready deployment.
- External GitHub stale-backup monitoring still requires default-branch delivery/configuration.
  Do not promote to `main` without explicit user authorization.

Next action: finish docs/diff review, request full canonical acceptance on the exact task
tip, deliver to a stable feature Preview, and hand the user the live TodoMate acceptance
steps without asking for credentials in chat.
