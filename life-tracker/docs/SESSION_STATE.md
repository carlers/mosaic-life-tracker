# Session checkpoint

Updated: 2026-10-11
Current task: Calendar TaskBlock title hard clipping instead of ellipsis. User requested the change, not dev/main promotion.

## Verified baseline
- Task branch and stable Preview start from dev `f65d348c2f537b4d8c1063096e6856a9ee3d629f` (v0.17.2).
- `src/components/home/views/TaskBlock.tsx` title uses `truncate`, which creates an ellipsis; its parent already clips overflow and prevents wrapping.
- Preview candidate v0.17.3 is a user-visible PATCH refinement; no Appwrite/backend or schema change.

## Candidate
- Remove only the title's `truncate` class, retaining `min-w-0` and the parent overflow clipping.
- Synchronize package.json, package-lock.json and src/lib/appVersion.ts to v0.17.3.
- No CSS-implementation assertion test: the change is purely visual, and repository test rules prohibit locking incidental Tailwind class structure.

## Verification / remaining
- Request focused task CI with `[verify:focused]`; review and repair any failures.
- Squash task branch `chatgpt/taskblock-hard-cut-20261011` into stable `fix/taskblock-hard-cut-20261011`, then verify full canonical CI, build-size checks and Vercel Preview at the exact stable commit.
- Manual desktop/mobile visual acceptance is still required to confirm hard-cut behavior at narrow widths and with the shared-task icon.
- Do not merge to dev/main or modify Production/Appwrite without user approval.

## Next action
Complete CI + Preview delivery, then request user acceptance of the Preview before promotion.
