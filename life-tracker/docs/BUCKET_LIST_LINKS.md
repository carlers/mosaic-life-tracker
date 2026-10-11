# Bucket List v0.19.0 — linked tasks

Approved implementation from issue #405, October 11, 2026.

- A Bucket List item is an independent private aspiration with optional linked **owner tasks**.
- Link records live in owner-private `bucket_task_links`; tasks remain canonical and unchanged when linked/unlinked. Their category, order, date/Backlog placement, visibility and share policy remain identical.
- One task may link to many aspirations; deterministic edge ID deduplicates. No social leakage or task-to-goal status propagation. An aspiration can be achieved with unfinished tasks.
- Link creation is guarded against cross-account, missing or tombstoned goals and tasks; unlink soft-deletes only the link. A goal deletion soft-deletes its links, not tasks. Creating a linked task is two local steps; retry a failed linking step against the already-created task ID, never create twice.
- Sync uses eighth existing-pattern owner pilot with explicit CAS, tombstones, freshness, account-local purge. New Git manifest migration `011-bucket-task-links` plus Function allowlist, owner erasure worker/policy, backup JSON/ZIP v4 with task+goal cross-account ID remapping and old-v1–3 restore compatibility. Scratch activation must be coordinated with #526; the current combined Function cannot be blindly replaced by task-branch code.
- Overview adopts restrained editorial cards and Someday/Lived tabs, while aspiration detail is a full-page swipe-back route. Quick add/edit, task picker and task actions use shared BottomSheet. Task side offers `Link to Bucket List` for owner's tasks. No new always-on Home subscription.
- Important acceptance: linked category/date/backlog/complete/uncomplete changes are live, task from one goal can link to two, no duplicate link or task after failure, private goal never added to shared task payload, owner accounts isolated, offline conflict policy and backup restore correct, no removal of task on goal unlink/delete.
