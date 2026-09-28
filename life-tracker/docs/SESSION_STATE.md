# Session checkpoint

Updated: 2026-09-28

Current task: complete live acceptance of the one-way TodoMate → Mosaic personal-data
migration on stable Preview branch `feature/todomate-importer`.

Status: the accepted importer was squash-delivered to `feature/todomate-importer` at
`8a52e113261b91dd960ecd38bb7ac79e7bbdd81a`; full Quality Gate 1263 and Vercel Preview
delivery passed. The first real-account Preview attempt exposed a browser CORS failure while
reading TodoMate's public Firebase init endpoint, before TodoMate authentication or Mosaic
writes.

## CORS regression fix
- Fix branch: `chatgpt/todomate-import-cors-fix`, based on stable Preview SHA
  `8a52e113261b91dd960ecd38bb7ac79e7bbdd81a`.
- The importer still prefers runtime public Firebase config discovery from
  `https://www.todomate.net/__/firebase/init.json`.
- If that public endpoint is blocked/unavailable in the browser, the importer falls back to
  TodoMate's pinned public Firebase web API key/project ID.
- The fallback contains no user credential or private token.
- TodoMate email/password still go directly browser → Google's Firebase Identity Toolkit;
  authenticated personal-data reads still go directly browser → TodoMate Firestore.
- No proxy/Mosaic backend receives TodoMate credentials, Firebase tokens, or TodoMate rows.
- Regression coverage simulates `Failed to fetch` on the init endpoint and proves the
  importer continues to direct Google login and owner-filtered TodoMate Firestore reads.

## Import behavior
- TodoMate remains read-only.
- Full owned `Goal`, `TodoItem`, and `Diary` history is previewed before Mosaic writes.
- Mosaic application is Merge-only through the existing restore engine.
- Groups/categories, task history/completion/memo/reminder/routine references, and diary data
  are mapped.
- Undated TodoMate tasks are reported and placed on the preview day because Mosaic requires
  task dates.
- TodoMate task photos and recurring routine definitions are reported but not reconstructed
  in the first version.
- Selected-viewer TodoMate visibility imports as private.

## Remaining
1. Run full exact-SHA canonical acceptance for the CORS regression fix.
2. Squash-deliver the accepted fix into `feature/todomate-importer`.
3. Verify the new Vercel Preview is READY.
4. User retries **Preview Transfer** with their TodoMate account; do not ask for credentials
   in chat.
5. If preview succeeds, compare counts/warnings with the TodoMate account before allowing
   **Import into Mosaic**.
6. After import, spot-check historical completed/incomplete tasks, categories, memos,
   reminders, diary entries, and Mosaic sync before marking the roadmap item complete.

## Separate DR follow-up
- DR work is already merged into `dev`.
- Production `dr_backup` is live at `0 11 * * *` with the accepted read-only deployment.
- External GitHub stale-backup monitoring still requires default-branch delivery/configuration;
  do not promote to `main` without explicit user authorization.

Next action: request exact-SHA full acceptance for the CORS fix, deliver it into the stable
TodoMate Preview branch, verify deployment readiness, then have the user retry Preview Transfer.
