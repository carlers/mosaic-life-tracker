# Session checkpoint

Updated: 2026-10-11
Current task: nested BottomSheet visual depth and paint-order correction, Preview v0.16.7. No dev/main promotion authorized.

## Verified baseline
- Started from `dev` `61f7b00696d50ee3fbc117ae7ccbcc26fca78c93` (v0.16.6), on task branch `chatgpt/nested-sheet-depth` and stable Preview `feature/nested-sheet-depth`.
- Scope is frontend-only. No Appwrite schema, Function, sync, or production environment changes.

## Candidate
- Shared `BottomSheet` gives every visible portal a depth-ordered sheet/backdrop pair, a lighter nested veil, a theme-aware border and shadow, and subtle parent recession with reduced-motion support.
- Preserve top-layer-only focus/interaction, browser/Android Back history, parent state retention until exit, drag dismissal and existing caller APIs.
- Browser regression checks painted backdrop ordering, parent geometry while nested, and restoration after Back.
- `docs/THEMING.md` records the depth contract. Product version is 0.16.7 consistently across three files.

## Verification
- The first focused run passed 1,454 tests and found only the required checkpoint heading missing.

## Next action
- Re-run focused verification on the checkpoint repair SHA and review the resulting checks.
- Squash task PR into `feature/nested-sheet-depth`; require stable Preview canonical acceptance and exact-commit Vercel Preview readiness.
- Do not merge into `dev` or `main` without explicit approval. Real iOS, Android, and desktop visual/touch acceptance remains manual and unclaimed.
