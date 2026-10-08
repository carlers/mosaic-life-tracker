# Session checkpoint

Updated: 2026-10-08
Current task: Foreground-only push notification toggle, and correct diagnosis of unavailable rich-detail toggle.
Task branch: `chatgpt/notifications-foreground-setting` from stable `feature/notifications-alerts` at `02686f5d`. Do not promote to dev/main without user instruction.

## Findings and changes

- The live production and scratch Appwrite `push_subscriptions` tables are missing `include_task_details` (006 migration). The frontend's `get_push_details` lookup is unavailable until that schema and Function activate, explaining the greyed-out preference. Do not modify production Appwrite without separate approval.
- Add a device-local `push-while-open` preference (default true) in the existing service worker IndexedDB metadata store. Notification Settings controls it independently of server push-detail permissions. When false, Chromium only suppresses system notifications while Mosaic is visibly open on this origin; background delivery continues.
- WebKit/Safari requires notification display for each push, so do not consume push events invisibly there; expose the browser restriction clearly in the UI instead.
- Improve rich-details error text to distinguish unconfigured backend from a transient lookup problem.
- Add unit and DOM regressions for visible vs hidden clients, WebKit fallback, account mismatch, failed persistence, and settings interaction.

## Next steps / rollout

1. Finish a single focused task verification commit, inspect and repair failures, then squash into stable `feature/notifications-alerts` Preview for canonical CI and Vercel readiness.
2. For full rich-content acceptance, apply migration 006 and activate the checked-in `message-action` Function in disposable scratch using the Git-owned backend workflow, then validate with disposable accounts. Production schema/Function changes remain separate.
3. Manual Samsung installed-PWA validation of visible/background/cold notifications and rich-details toggle after backend activation remains required. Device acceptance is not automated.
