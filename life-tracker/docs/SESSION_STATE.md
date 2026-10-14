# Session checkpoint

Updated: 2026-10-14
Current task: #592 CI-first Vercel Preview cutover after live trusted shadow.

## Verified baseline
- Protected `main@8df24c13de16c28a5a1c6154199da5e19506f089`, Production app 0.17.4, full Quality Gate #38505671065 SUCCESS; Vercel Production `dpl_Gd2R2kYEU51syibVbSufpNgtJFv9` READY. Main ruleset active with zero bypass actors. Infrastructure-only #807 merged through owner-reviewed exception, which has been removed.
- `dev@f3d9558f` app 0.23.4, #784 two blocking/five advisory build metrics. Separate #784 audit already installed.
- Accepted stable canary `fix/592-trusted-archive-20261014@56ceb5af2beef4e1c248a52d5395517306294cb2`: full Quality Gate #38506106029 SUCCESS and matching Git Preview `dpl_5jpJDKxaPZgfBJn1zm1rUzgiif4n` READY.
- The *real default-main* read-only [Trusted Preview Delivery #38506275297](https://github.com/carlers/mosaic-life-tracker/actions/runs/38506275297) SUCCESS. It independently admitted canonical run 38506106029/1 and verified all 161 ZIP/tar/static files, Scratch, GIPHY/PostHog, two hard budgets, pinned SPA routes and headers, latest SHA. Provider history: ONE Git Preview, ZERO extra provider creations, alias writes, or candidate executions from the receiver. Existing premature Git auto-creation remains ON.
- Owner-provisioned public Preview values exactly matched Vercel; masked GitHub Actions Secrets. No private provider credentials in untrusted CI.

## Active unprivileged writer stage
- Main-based task branch stages a separate, default-OFF `prebuilt_writer` job; read-only shadow stays credential-free. New job requires **two** independent vars `MOSAIC_PREBUILT_WRITER_ENABLED=true` AND `MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED=true`, successful shadow, protected main checkout and explicit owner-approved canary rollout.
- Only fixed main-owned Node code and pinned `vercel@63.1.2` (installed in a separate step with no provider secret/installer hooks) can upload the already verified Build Output API v3 bytes to explicit Preview; no app scripts or rebuild. Recheck source/CI right before any POST, Vercel project root/repo/prod branch, READY and deployment metadata; dedupe/list history and check stable alias only with additional opt-in.
- Vercel `git.deploymentEnabled` rules are additive. Existing `fix/*: true` would cancel a specific canary `false`; the proposed cutover must **replace** that broad rule with a verified disjoint `fix/!(592-trusted-archive-20261014): true` minimatch allowlist, preserve main/dev true and other stable categories, and require that exact config before any provider POST. Confirm matching on Vercel without weakening CI and prepare rollback. This is **not yet activated**; effective feature build routing fingerprint must account for the reviewed configuration edit before cutover.
- Main-based writer code/testing staged only, no token or Vercel setting/alias/Production changes. #592 OPEN.

## Next action
- Focused CI for writer/policy, then stable main-based canonical Quality Gate+Preview, and a new narrowly reviewed protected-main infrastructure-only PR/owner approval. All toggles remain OFF.
- Reconcile reviewed `vercel.json` fingerprint and Git-rule semantics for one isolated canary; prove red=zero created Previews, green=one exact accepted prebuilt deploy, stale/retry=zero duplicates, routes/headers/Scratch, stable alias and rollback. Expand to normal stable categories after evidence and one real feature→dev promotion. No change to main/dev Git auto deployments until separately reviewed.
