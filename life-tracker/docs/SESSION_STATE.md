# Session checkpoint

Updated: 2026-10-20 UTC
Current task: Promote approved sticky Calendar weekday header (#952) to dev while preserving concurrent category improvements.

## Boundary
- Latest protected dev baseline: `9139816ac73817cb714d300282c314c83e8fbcc4` (v0.30.1). It already includes accepted inline Category Manager editing (#1037) and reverse order (#1036); do not overwrite or bypass either.
- Source approved by user: `feature/sticky-weekday-header-952-20261020@b937cddb7a31c21058603e33f78e06c3addb7610` (v0.31.1), canonical CI #39295635684 SUCCESS, trusted delivery #39295973967 READY; user manually verified original Calendar background and authorized merge to dev.
- Concurrent dev movement invalidated initial integration baseline `682303946c00b14ee3ac3fc3e33b2dc541a39a86`. First task `chatgpt/sticky-weekday-952-dev-integration-20261020@2b976cede61d096c570dbb45d44532f53c473e9e` passed focused Quality Gate #39297547128, but must not promote its stale base.
- New task branch: `chatgpt/sticky-weekday-952-current-dev-20261020`; new stable Preview: `feature/sticky-weekday-952-current-dev-20261020`, both directly from current dev above. Distinct integration Preview version: v0.31.2.
- Scope: frontend-only; no Appwrite backend changes and no main/Production authorization.

## Changes
- Carry the user-accepted synced sticky weekday header switch and pinned row in month/week views, including own/friend Calendar, 7/4/3-day zoom, original `bg-background` theme, and preserved scroll/keyboard semantics.
- Preserve current dev Category Manager source, category hook and tests exactly as-is, including inline editor and reverse action.
- Merge additive sticky browser geometry probe/test into dev's existing category editor geometry probe/test so both test cases run.
- Keep the three application version identifiers synchronized at 0.31.2.

## Verification
- Pending exact new task focused Quality Gate, canonical integrated stable Preview CI, trusted Vercel delivery, and approved protected dev promotion evidence. Historical Preview and stale task CI are not proof for this combined commit.

## Next action
- Complete focused verification on this latest-dev integration, squash into its stable Preview, validate full canonical acceptance and trusted READY for exact SHA, and only then create and merge a two-parent promotion PR to dev after live branch and promotion-preflight checks. Do not change main or Production.
