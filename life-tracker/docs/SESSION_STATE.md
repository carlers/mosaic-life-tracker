# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate import/sync performance and race hardening on stable Preview `perf/todomate-import-sync-audit`, with progress-channel consolidation on `chatgpt/todomate-import-sync-progress-consolidation`.
Status: Stable code head `f9855f1` passes the build-size guard at 682,288 B / 682,300 B, but that 12 B margin remains inside the ~13 B gzip variation observed between otherwise identical Vite rebuilds. The fixed budget remains unchanged. The TodoMate-specific duplicate progress path has already been removed; this follow-up consolidates restore progress globally so `RestoreOptions` has one detailed progress callback instead of parallel simple+detailed channels. Generic Backup & Restore derives its existing text from `onProgressDetail.message`; TodoMate continues to use the same detailed message+percentage stream. Replace-mode safety-backup text is emitted through the same detailed channel. No restore ordering, validation, ownership, conflict, image, sync, or visible progress behavior changes.
Next action: Run focused verification, then squash-merge into `perf/todomate-import-sync-audit`. Require stable full canonical CI and a READY Vercel build with enough app-assets gzip headroom to survive the observed rebuild jitter. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Verification target

- Backup & Restore still shows restore phase text, including replace-mode safety-backup work.
- TodoMate still shows detailed restore text and percentage.
- Photo progress remains driven by the existing image-completion callback.
- Existing restore, account-isolation, large-import, and task-replication regressions stay green.
- Stable build-size margin is materially greater than the observed rebuild variation.

## Accepted implementation retained

- Four-worker TodoMate photo preparation and restore upload.
- RxDB `findByIds()` restore planning.
- Zero-deflate TodoMate WebP migration ZIP entries.
- TodoMate-precompressed upload reuse.
- Create-first fresh TodoMate task replication with 409 fallback.
- Prepared-preview Mosaic account ownership guard.
- Bounded post-restore convergence and sync-pending semantics.
