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

- Owner confirmed the protected GitHub Preview environment, Vercel secret and opt-in toggle have been configured; this GitHub connector cannot read back these private settings. Four canonical CI workflows at `468dff53` passed, while deployment was SKIPPED because the previous job ran before enablement. To trigger the next accepted push, fix actual Vercel API project identity readback compatibility: accept exact `projectId` or nested `project.id` and require both to match when both are present. Maintain Preview-only READY/source/provider/artifact verification and required CI gates. No dev/main/Production writes.

- 2026-10-22: User explicitly approved protected Preview deployment, updated Vercel environment token, and requested agent-led retry to avoid manual back-and-forth. GitHub run #39809123171 attempt 1 staged 179 authentic Supabase files then Vercel CLI failed `scope-not-accessible`. Root cause in workflow: it passed the Vercel token as an environment variable but not `--token`, so the CLI did not use the protected credential. Attempt 2 of the job stopped safely during artifact verification because reruns can retain the attempt-1 GitHub artifact. Repair both with explicit masked CLI `--token` and exact-SHA/run bounded prior-attempt artifact selection; maintain Preview-only project, SHA and hash checks. The user expects agent-controlled Preview delivery. Current feature SHA `c000c42d`, version 0.44.0, all canonical checks successful, no Preview/Production deployment yet. Do not weaken environment reviews, dev/main/Production gates, or copy credentials into source/logs.

## Next action
- Check focused tests and exact-SHA canonical CI; confirm delivery job skipped/enabled actual outcome without fabricating READY evidence. If protected credentials are configured, inspect the immutable URL in Vercel and perform signed disposable ZIP → TodoMate Replace, second-device/foreign-owner privacy and offline convergence. Personal ZIP is not uploaded to CI.
- Before real-user cutover: proof of legacy Appwrite↔Supabase owner mapping, old-PWA **server-enforced** writer fence, post-Oct-18 source delta, partial-domain/media disclosure, signed owner/device acceptance, independent rollback and explicit dev/main/Production approval. Keep #1250/#1027/#914 open.
