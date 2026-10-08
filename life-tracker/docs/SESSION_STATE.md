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

## Verification and delivery

- Foreground feature task `cd802d9a` passed focused CI, then PR #375
  squash-merged to stable `feature/notifications-alerts` at `ffcbfe3d`.
- Canonical GitHub unit/DOM/build/static/dependency checks passed at
  `ffcbfe3d` (browser checks also running); Vercel build measured slightly
  larger aggregate and precache assets than GitHub and rejected only the
  tight size guard: Vercel raw 2,288,564 / 2,287,800 and precache
  2,371,091 / 2,368,700. GitHub size guard passed.
- Budget repair branch `chatgpt/notifications-foreground-size-budget`
  documents the exact provider-matched growth and revises only aggregate
  raw/gzip/precache ceilings. Entry, startup and Home ceilings are unchanged.
  Run focused verification, squash the repair to stable Preview, then wait
  for canonical success and Vercel READY.

## Backend / manual acceptance remaining

- Production and scratch Appwrite currently lack the
  `push_subscriptions.include_task_details` column. Rich-detail toggle remains
  disabled until 006 and a compatible message-action Function are explicitly
  rolled out using the Git-owned scratch-first backend workflow; no backend
  project has been mutated.
- Manual Samsung PWA testing of foreground ON/OFF, background/cold delivery,
  lock-screen details (after server rollout), and notification tap-through
  remains outstanding. Do not claim device acceptance from browser CI.
