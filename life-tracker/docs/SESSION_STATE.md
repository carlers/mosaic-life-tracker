# Session checkpoint

Updated: 2026-10-22 local (2026-10-21 UTC)
Current task: #1029 Supabase Diary domain, revised public core+Diary release #1027, category lifecycle #857.

## Live state and release safety
- Isolated Supabase core candidate branch `feature/1027-supabase-recovery-20261020@7ca47047ab5eab74b90656dc05e14f133391d112` passed exact-SHA Quality Gate #39639293585 and signed Supabase Core App Lab #39639293771. Public hosted mosaic-dev has owner-filtered task/category Realtime publication and remains invitation-only. The owner reports near-instant two-device task sync now works on protected immutable v0.32.5 Preview. Full public release, `dev`/`main` promotion, Production/other Appwrite account cutover and 1.0 remain unperformed.
- Owner explicitly revised release scope on 2026-10-21: **public core tasks/categories/calendar/backlogs PLUS owner-private Diary**, social/chat/alerts/shared/media postponed. No invitation-only beta as permanent product. Remove invitation gate only after safe public Auth/abuse checks, Diary end-to-end, backups/provider return, device/PWA and exact release verification.
- #857 supersedes evolving category names: preserve historical tasks and category identity when **retired at an effective day**, expose separate explicit **Delete category and all tasks** with confirm and soft tombstones, never implicit reassignment. Existing #1186 automatic rehome is interim and must be replaced after migration and tests. Two preexisting orphaned task rows in isolated hosted owner account remain untouched.
- Current `dev` and `main` are significantly divergent with newer app features; never merge this old Supabase beta tree directly into them or alter Production without explicit accepted reconciliation and release approvals.

## This task branch
- `chatgpt/1029-private-diary-supabase-foundation` starts from `7ca47047ab5eab74b90656dc05e14f133391d112`. Scope: additive, **disposable-only** owner-private Diary SQL baseline, no UI flag or runtime writer/hosted migration. No version bump (not user-testable).
- New `20261022_candidate_private_diary_domain.sql`: owner/date-unique text/emoji Diary with legacy photos references preserved, private-only visibility, strong RLS, SELECT+INSERT authenticated only, revision and signed core authority triggers, exact-revision owner-only CAS with content/emoji/deleted allowlist; no anonymous/foreign reads or direct UPDATE/DELETE; not yet published via Realtime.
- Disposable Supabase Core App Lab copies this migration after core authority and verifies catalog contracts using `20261022_private_diary_contract.sql` before signed UI tests.
- Must not apply to hosted until task branch focused, stable exact-SHA signed tests and Diary transport/owner negative tests pass. No DB/app user data changes here.

## Next action
- Run task-focused GitHub Quality Gate; fix SQL/test failures, then only after acceptance squash into stable isolated core branch and rerun canonical labs. Implement Diary mapping, authenticated create/CAS/pull, RxDB replication start/stop and foreground/realtime wake with signed two-owner negative + offline/concurrent/erase tests before capability activation.
- In parallel, implement #857 category retirement metadata with RxDB migration and Supabase signed CAS plus Day/Calendar/Backlog rules; explicit cascade tombstones and recovery/undo; test on both providers independently.
- Reconcile current `dev` app line and exact prebuilt Preview before launching public domain, disable invite gate only with public Auth abuse controls, independent backup/restore/provider-return and explicit Release approval. Keep #1027, #1029, #857, #1186 open until verified.
