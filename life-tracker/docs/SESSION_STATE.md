# Session checkpoint

Updated: 2026-10-11
Current task: restore intermediate release-history versions missing from accepted Preview v0.16.8; corrective Preview v0.16.9. No dev/main promotion authorized.

## Verified baseline
- Stable Preview `feature/granular-release-history` at `b16281d7b6f11ab69ab1575f07b31e8c97dc2228`, canonical CI `38109449436` SUCCESS and Vercel READY. dev `b76ca6295a8409309c232b25d44fa7f63cbc6878`, main `614cd1dccbd01bf70493874496559720b320151a`.
- GitHub Releases expose only v0.12.1, v0.12.2 and v0.16.6. The v0.16.8 parser only displayed embedded milestone sections; no existing release had them. Historical backfill was deferred until a future main publisher run, so Preview could not show intermediate updates.
- The accepted stable Preview PR histories show v0.14.0–v0.14.5 shared-task and v0.16.0–v0.16.5 sticker revisions included in production v0.16.6; v0.12.0 release history became v0.12.1. v0.13.0–v0.13.2 custom-sticker prototype and v0.15.0 backlog remain Preview-only, not separate production releases.

## Candidate
- Branch `chatgpt/release-history-missing-milestones` starts from stable Preview `b16281d7`; update to v0.16.9 in three version files.
- Checked-in bounded public-PR provenance snapshot with exact stable Preview PR merge SHAs and shipped/Preview-only classification. Render missing version rows immediately inside genuine published release groups or in separately labeled Preview-only section. Prefer publisher notes for duplicates. Existing offline cache gains the rows without refetch.
- Future trusted historical notes backfill validates archived merge PR, merge SHA, stable Preview base and versioned source tree before publishing; no direct tags/Release edits or backend changes.
- Unit and DOM regressions cover v0.12.0/v0.14.x/v0.16.x shipped versions, Preview-only v0.13.x/v0.15.0, deduplication, provenance URLs, offline fallback and semantics.

## Verification
- Focused task SHA and canonical Preview full gate plus Vercel Preview must pass. iOS/Android/manual browser acceptance remains unclaimed.

## Next action
- Commit implementation and checkpoint with `[verify:focused]`, inspect focused CI, repair failures.
- Squash into stable Preview only after focused green, inspect canonical CI and exact-SHA Vercel READY, and report stable alias.
- No promotion to dev/main absent explicit user instruction.
