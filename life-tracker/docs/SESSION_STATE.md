# Session checkpoint

Updated: 2026-10-09
Current task: #403 selected-task clipboard copy + #411 chat message right-click
Task branch: `chatgpt/interaction-quick-wins`, based on dev `74aa8877ce742fb8cb6059ee65dfa505df6e29b1`
Stable Preview target: `feature/interaction-quick-wins`
Candidate Preview version: `0.7.0`

## Objective and constraints

- In Day View selection mode, copy selected titles as plain-text bullet points in the same visible category/task order as the day list; preserve selection and show clipboard failure/retry feedback.
- On desktop, right-click an actionable message to open the existing long-press action sheet; leave native menu intact when the shared gesture hook has no custom handler; do not interfere with unsent bubbles or active overlays.
- Reuse existing ordering, hooks, feedback, bottom sheets, and theme tokens. No Appwrite/database/schema changes.

## Implemented in task candidate

- Added a toolbar Copy action, deterministic clipboard formatter, guarded async clipboard feedback, and coverage for ordering, Unicode, empty/hidden groups, successful copy, rejection/retry and missing API.
- Wired message contextmenu to the existing long-press action; corrected conditional native-menu suppression and disabled bubble gestures during message-related overlays.
- Added DOM coverage for exact clicked message, native menu fallback, disabled/unsent messages and touch long-press.
- Stamped version 0.7.0 in package manifest, lockfile and app version.

## Verification and delivery

- First focused run [37913029349](https://github.com/carlers/mosaic-life-tracker/actions/runs/37913029349): 1,278 passing tests and three failures in newly added clipboard tests only. Root cause: test fixture tried to assign inherited getter-only `navigator.clipboard`; subsequent task repair uses an own-property descriptor. No app-code failure identified by that run.


Next action: publish one coherent task commit with `[verify:focused]`, investigate/fix any CI failures; open PR into stable Preview and squash-merge after focused green; require canonical full CI, build/size/browser checks and exact-SHA Vercel READY. Update issues #403 and #411 with milestone evidence. Do not promote to dev/main without explicit user authorization. No manual mouse/touch/browser-login acceptance is claimed.
