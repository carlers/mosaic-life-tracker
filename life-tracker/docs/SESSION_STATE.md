# Session checkpoint

Updated: 2026-10-14 UTC
Current task: #592 trusted prebuilt writer — eliminate CLI scope-triggered account lookup.

## Verified
- Protected main infra-only [PR #822](https://github.com/carlers/mosaic-life-tracker/pull/822) merged at `70104058ba71cd5f8e3df3f3db24204609e6be0e`; exact [main Quality Gate #38529094461](https://github.com/carlers/mosaic-life-tracker/actions/runs/38529094461) SUCCESS, Vercel Production `dpl_2rvyzRjQk7N2e9zK68PqhxhLJ6P5` READY, app v0.17.4 unchanged. Ruleset #24880070 active/zero bypass; `dev@f3d9558f` unchanged.
- [Task-focused #38529675844](https://github.com/carlers/mosaic-life-tracker/actions/runs/38529675844) PASS and [PR #823](https://github.com/carlers/mosaic-life-tracker/pull/823) squash placed artifact-integrity regression on canary stable `fix/592-trusted-archive-20261014@64625a0ef6dc4850ce259c8a0d3586ea4d858025`. Exact [Quality Gate #38529824578](https://github.com/carlers/mosaic-life-tracker/actions/runs/38529824578) full canonical SUCCESS. Provider Git deployment list for that SHA remains EMPTY: corrected canary=false suppression continues working.
- [Trusted Preview Delivery #38530036833](https://github.com/carlers/mosaic-life-tracker/actions/runs/38530036833): read-only receiver SUCCESS; protected writer FAILURE before creating any deployment. CLI v62.7.0 reported `--team is deprecated` and `Not able to load user because of unexpected error: User not found (404)`. Previous `--scope team_ID` trial failed identically. Live authenticated Vercel project/history GETs succeeded before both CLI attempts. Do not retry these runs. No aliases, app/runtime, Production or backend changes.
- Vercel CLI upstream dispatcher routes BOTH `--team` and `--scope` through a synchronous user-identity lookup before running deploy; that is the observed error layer. Exact account-visibility limitation of the protected token is not independently identified.

## Active main-based narrow fix
- Omit both CLI account-scope flags; retain exact Preview-only `--prebuilt --target=preview`, immutable SHA metadata, reviewed team/project plan, `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`, explicit `.vercel/project.json`, authenticated project GET, retries/duplicate checks and alias OFF. Per Vercel docs the env vars and local link select project in noninteractive CI.
- Add argv regression forbidding both flags/shorthands and passing team ID to the CLI. Code/test/docs only, no token change or provider write. The next live CLI stage is still unproven.

## Next action
- Focused task CI, squash into new main-based stable Preview, require full canonical + Git Preview READY; prepare ONE protected-main infrastructure-only PR requiring NEW owner-approved temporary PR-only ruleset exception, merge commit, immediate zero-bypass restoration and main canonical/Production v0.17.4 checks. **Do not merge before explicit owner approval.**
- After main code is verified, one new eligible canary task→stable SHA and full canonical; exact project-scoped Vercel zero Git creations, protected prebuilt READY with Scratch/GIPHY/PostHog, routes/headers, idempotency, stale+rollback checks. No routine feature cutover, aliases or #592 closure before proof.
