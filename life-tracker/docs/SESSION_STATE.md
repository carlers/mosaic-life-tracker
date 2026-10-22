# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1250 unify protected Supabase Preview delivery, then signed personal ZIP → TodoMate catch-up acceptance.

## Trusted state
- Isolated Supabase recovery branch baseline `feature/1027-supabase-recovery-20261020@e7af1ae0de783474895cca37ab29c48d74225d67`, version **0.44.0**, has green exact-SHA Quality Gate, Core App Lab, Synthetic Restore Lab and Real GoTrue Restore Lab. Production/dev/main unchanged.
- Personal Mosaic ZIP/JSON Merge and destructively confirmed TodoMate **task/category-only Replace** are implemented for the candidate signed Supabase core. Private Diary is opt-in separately; photos/settings/Bucket List/social are not yet fully synchronized. Preserve original ZIP and PWA cache.
- Archived Appwrite Oct 18 R2, after global erasure filtering: five eligible Auth owners, 2,361 historical rows and 121 files. Current Appwrite source is quota suspended. Post-Oct-18 changes and stale-client writer fencing unverified.
- The exact source Supabase CI artifact 12432475414 was independently SHA-256/179-file verified, but not yet deployed. The old protected immutable Supabase Preview belongs to an older source SHA, not v0.44.0.

## This task
- Add optional Preview-only prebuilt delivery job to the existing Supabase Core App Lab. Preserve the existing exact-SHA static CI artifact, require same-SHA Quality Gate success, current branch tip, artifact digest, and clean source checkout before constructing bytes through trusted `stage-supabase-core-artifact.mjs`.
- Pin Vercel CLI and deploy immutable Preview bytes only, behind a separate protected GitHub environment, reviewer branch restrictions, environment Vercel token/target variable and an explicit disabled-by-default repository toggle. Verify READY/project/provider/SHA/digest; no aliases, hosted data, shared settings or Production changes.
- Add fail-closed negative unit tests and document one-time trusted configuration. Tooling-only, version impact NONE. Work on isolated task branch → focused CI → squash into same isolated feature, canonical exact-SHA acceptance.
- Environment secrets and the enabling variable cannot be inspected/created by this GitHub connection; DO NOT assume they exist or authorize a deployment. Job must skip until trusted operator config, and any attempt with missing config must fail closed.

- Vercel's actual Preview deployment readback uses `target:null`; the guarded verifier now accepts that value only alongside READY, exact approved project, source and digest, while still denying Production/staging.

## Next action
- Check focused tests and exact-SHA canonical CI; confirm delivery job skipped/enabled actual outcome without fabricating READY evidence. If protected credentials are configured, inspect the immutable URL in Vercel and perform signed disposable ZIP → TodoMate Replace, second-device/foreign-owner privacy and offline convergence. Personal ZIP is not uploaded to CI.
- Before real-user cutover: proof of legacy Appwrite↔Supabase owner mapping, old-PWA **server-enforced** writer fence, post-Oct-18 source delta, partial-domain/media disclosure, signed owner/device acceptance, independent rollback and explicit dev/main/Production approval. Keep #1250/#1027/#914 open.
