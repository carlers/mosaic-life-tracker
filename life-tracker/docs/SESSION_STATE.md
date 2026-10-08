# Session checkpoint

Updated: 2026-10-08. Active task: user-requested Version disclosure refinement on `chatgpt/alerts-version-details-collapse`, based on accepted Alerts Preview `feature/notifications-alerts` commit `61b6791b`.

## Scope and current state

- The combined Alerts + semantic versioning stable Preview first shipped **0.5.0** with full canonical CI and READY Scratch Vercel. This subsequent **user-testable Preview refinement is 0.5.1**.
- Settings keeps **Version** and its number visible by default, with all app/build diagnostics (effective Appwrite backend, branch, commit and message) hidden until the Version row is opened. The existing multiline commit message disclosure remains nested/independent.
- Keep exact Appwrite isolation unchanged: Preview and dev use Scratch; main uses Production. Production `push_subscriptions.include_task_details` still needs approved `006-push-details` migration before a main backend activation. No backend changes are part of this task.
- Keep the Preview `feature/notifications-alerts` as the accepted destination; PR #387 to dev remains draft until explicit user approval. No dev/main production merge is authorized by this request.

## Task delivery

- Update Settings interaction and DOM regression, synchronized package/lock/app version 0.5.1, and affected UI/docs in the **same** coherent focused task commit.
- Verify focused CI on task branch, squash to stable Alerts Preview, then full canonical CI, Vercel READY and size guard. Use the registered stable Alerts Preview alias.
- Browser/device manual acceptance of the updated disclosure and Alerts retention cross-device syncing remains separate from CI.
