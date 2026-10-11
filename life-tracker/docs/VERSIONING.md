# Versioning protocol

Mosaic publishes a **human-readable Preview/release version** and an independent **deployment build identity**. Versions follow the `MAJOR.MINOR.PATCH` shape (no prerelease identifiers in the current policy). The Git SHA always identifies the exact deployment, even across builds with the same product version.

## Agent-owned version decision

Every task plan that changes shipped user behavior must state a recommended version impact and candidate, checked against `main`, `dev`, and active stable Preview branches. Agents should handle the bookkeeping; the user approves the plan and later authorizes promotion as usual.

| Situation | Decision |
|---|---|
| New user-facing capability or meaningful feature in pre-1.0 Mosaic | **MINOR**, resetting PATCH to zero |
| Each *successfully delivered, user-testable* subsequent Preview revision of that feature (fix or refinement) | **PATCH** |
| Standalone production hotfix | **PATCH** relative to the latest production release |
| Only docs, tests, workflow, refactoring or internal tool changes that do not change an independently testable app revision | **NONE** |
| Breaking behavior / 1.0 milestone | **Explicit review**; never automatically cross to 1.0.0 |

Mosaic's pre-1.0 PATCH-as-Preview-revision convention is deliberately more granular than strict SemVer's bug-fix meaning; it is for user-facing traceability. Do not bump for every commit, invisible repair, failed build, queued CI job, or unaccepted intermediate task branch. A Preview version is prepared in the **same candidate tree** as its user-facing changes, before the branch's canonical acceptance and Vercel delivery. When an accepted Preview is refined, increment PATCH once for the *next* successful Preview candidate, batching internal repairs until ready. If a candidate fails, fix it without repeatedly incrementing the pending version. Version numbers used by earlier Preview deployments are not recycled for different content after publication.

The initial version for a feature branches from the current production/integration baseline and resolves any active branch collisions. The agent must inspect active Previews before choosing a free minor line; if two features are in flight, do not issue the same version on separate published Preview trees. The version and its changes are carried **unchanged** by the accepted stable Preview -> `dev` -> `main` merges. A changed version *after* acceptance changes the tree, so it requires new Preview acceptance rather than bypassing the promotion check.

Before dev promotion, compare against the latest `dev` version and recent commits; before main promotion, compare against `main` and the latest release tag. Never promote a lower version or silently collide with a different released tree. If merge order changes or an unrelated accepted feature has entered dev, resolve content/version conflicts on a fresh task branch, assign a new increasing version, and re-run Preview acceptance. Do not use an identical version for two materially different product releases. An urgent production hotfix starts from `main`, gets an incremented patch and then is forward-ported to `dev` without silently lowering dev's version.

For feature work, the agent proposes version impact during planning. User approval of implementation authorizes the proposed Preview version; changes to impact or release scope are explained when they arise. Explicit approval is still required for stable Preview -> dev and dev -> main promotions. No background automated release or surprise major bump.

## Version files and commands

The version must match in:

- `life-tracker/package.json`
- `life-tracker/package-lock.json` (both top-level and root-package entries)
- `life-tracker/src/lib/appVersion.ts`

From `life-tracker/`:

```bash
npm run version:check
npm run version:bump -- minor
npm run version:bump -- patch
npm run version:set -- 0.4.2
```

`version:set` supports deliberate conflicts/reallocations and only accepts a strictly increasing stable version. `major` is supported by tooling but requires explicit user-approved milestone/compatibility decisions. All commands fail on inconsistent source version fields. `contracts:check` also validates their consistency in focused and full CI. The agent reviews the version/file diff and includes version changes in the normal task checkpoint, **not** an extra post-acceptance commit.

## Backend identity, Preview isolation and shared Scratch

The Settings diagnostics display `appwrite: production` or `appwrite: scratch` based on **the effective browser SDK project ID AND endpoint**. Misconfigured pairs/forks show `custom`, and unavailable values show `unknown`; never infer identity solely from a branch name or Vercel channel. The readable label is intentionally user-visible and not an authorization to connect to arbitrary accounts.

All official Vercel Previews (including `dev`) use Scratch Appwrite `My first project` in Frankfurt; `main` uses Production Appwrite `Mosaic` in Singapore. New Vercel Preview builds fail closed unless the exact scratch project/endpoint and explicit Function ID are provided. Official production builds reject explicit mismatched backend overrides, while accepting the deliberate production fallback. Normal frontend-only changes do not require an Appwrite mutation or cloud provisioning. Preview builds **do not** see real production accounts/data.

Scratch is a shared, sometimes disposable DR slot, not a separate backend per Preview branch. Schema/Function changes must be coordinated and checked against active Previews, prepared using [scratch readiness](SCRATCH_PREVIEW_WORKFLOW.md), and never silently copied/activated from Production. Backend-dependent rollout requires an explicit target, reviewed additive migration and exact Function deployment; production writes require their own approval. The stable branch Vercel alias must be registered with scratch Appwrite as a Web platform before claiming login works. Historical Preview artifacts built before isolation may still target Production; rebuild and verify rather than trusting the branch name.

This consolidated Alerts + versioning deliverable is first published as `0.5.0`: the previous standalone versioning Preview published `0.4.0`, while Alerts was built as `0.3.0`. Later accepted refinements are `0.5.1`, `0.5.2`, etc. The accepted release version remains the same in dev and main.

## Commit titles and release notes

Agents set descriptive `commit_title` and `commit_message` when squash-merging task -> stable Preview and when merge-promoting Preview -> dev -> main. Avoid titles like "promote current dev" or "release approval merge branch". Use:

```text
feat: v0.4.0 — Add notifications and alerts

- Show friend task completion alerts
- Manage notification retention
- Navigate alerts to friend day views
```

For a multi-feature release, write a representative headline and summarize **the actual aggregate diff against the prior production release**. Keep provenance, accepted CI/deployment status and the source SHA in the PR body, not as the sole Git commit message. This full subject/body is exposed in Settings using an expandable native disclosure. The Vercel-provided `VERCEL_GIT_COMMIT_MESSAGE` is embedded only in deployment-specific `index.html` metadata (not hashed JS).

Production Git tags use `vMAJOR.MINOR.PATCH` on the **actual accepted main merge SHA**. Only create a tag/GitHub Release after successful main canonical checks and production deployment readiness are verified. Fail closed on an existing tag pointing at a different commit; no force-moving tags. A release note summarizes user-facing changes and links the production PR. The trusted production release-publisher workflow performs tag/release publication after verified main CI and the exact live Production deployment. Agents do not manually create production releases during ordinary promotions. Publication failure remains a visible Actions failure and must be investigated. Preview revisions are never tagged as completed production releases. Backfill historical `v0.3.0` only against its verified production SHA, never guess an ancestor.

## Automatic production release publisher (#476)

The trusted `.github/workflows/publish-production-release.yml` listens for successful `Quality Gate` completions on `main`. It also supports a manual workflow retry and checks every six hours for delayed/missed triggers. It requires the exact new main SHA to remain current, a two-parent approved production promotion merge, all three consistent version files, a **strictly increased product version compared with main's first parent**, a successful exact-commit `canonical-acceptance`, and the merged production PR's `## User-facing release notes` section (legacy `### User-facing changes since vX.Y.Z` is also recognized). Agent-written notes must include all user-facing changes since the previous production release and no private or placeholder material.

Production readiness is independently checked using both an exact-commit successful GitHub `Vercel` status for the known Mosaic project and the **public production origin's** `mosaic-build-info` meta with matching `commit`, `branch: main`, and `channel: Production`. The publisher polls only for a bounded period; a later scheduled/manual rerun can recover. The latest main HEAD must remain unchanged before tagging or publishing. A docs/workflow-only main merge with the same version skips cleanly. It uses the standard ephemeral GitHub Actions token with job-scoped `contents: write`, never a personal PAT, Appwrite or a browser API key.

Tags are created directly on the verified production merge commit; any existing tag at a different commit or non-stable draft/prerelease causes a hard failure. Successful retries reuse verified existing releases, or publish an already-correct tag without recreating it. A newly published stable release is read back from GitHub, becoming available to Settings → Release history on refresh (or after its 15-minute cache). No Preview or dev merge can publish.

**One-time historical v0.12.1 bootstrap (approved in issue #476):** Because production Release history was empty when the publisher was installed, the trusted publisher includes a deliberately narrow fallback for current and previous main source both at `0.12.1`. It verifies the historical production promotion PR #505, exact original main SHA `95c8b25edeba5e2730252f6d265d392949890caa`, its first-parent version `0.6.2`, accepted canonical CI, recorded successful Vercel production deployment status and ancestor relationship to current main. Only after current main canonical CI and Vercel status succeed may it create missing `v0.12.1` on **that original SHA**, with curated user-facing notes and the actual publication timestamp. A mismatched existing tag, draft/prerelease, missing proof or newer already-published version blocks it. A matching published release is a no-op; a matching tag without a Release resumes safely. Future user-visible releases continue to use the ordinary strictly increasing version gate. No other version is automatically backfilled.

## Granular production version milestones

Each approved `dev` → `main` release keeps one immutable production tag and one GitHub Release. The trusted publisher also records verified, distinct user-testable minor/patch versions **included in that release**, not separate Preview GitHub Releases. The source is the accepted dev integration's first-parent merge history reachable through the production merge's second parent. The publisher validates each candidate's semantic version against its own historical `package.json` tree, excludes task/Preview-only revisions, and keeps only versions strictly above the prior production version and no higher than the new release. The oldest qualifying dev promotion for a repeated version supplies the user-facing milestone title and up to three non-internal note bullets. Missing provenance is omitted, never invented.

Milestones are appended to the existing human-reviewed aggregate notes in a bounded Markdown section delimited by `<!-- mosaic:milestones:v1 -->` and `<!-- /mosaic:milestones:v1 -->`. The browser parses these into collapsible patch/minor rows grouped beneath the production release. The regular aggregate notes remain available separately. The official release tag stays bound to the production SHA. The full Git history in the trusted publishing workflow is necessary for checking the candidate trees. A pinned, one-time v0.16.6 notes-only reconciliation reconstructs the released v0.12.2→v0.16.6 dev milestones after a verified subsequent production publication; it checks the original release tag, published state, original merge parents and current main ancestry before PATCHing only the release body. It never moves tags or creates fabricated releases.

Settings renders a bounded subset of release-note Markdown (headings, emphasis, lists, links, quotes and code) with React escaping and HTTP(S)-only clickable links. It renders saved account-independent releases synchronously before refreshing a stale cache, retaining public notes offline and never adding release fetches to the startup path. No Appwrite schema or account identity is involved.

## Public release history publication

Settings → Release history reads **published, stable GitHub Releases** from the public `carlers/mosaic-life-tracker` repository, on demand. Drafts, prereleases, malformed tags and Preview-only versions are excluded. The browser retains only a bounded, public release-notes cache for offline reading; the application does not use Appwrite accounts or ship fabricated changelog records. The list is empty until genuine production Releases exist.

For every approved `dev` → `main` production promotion:
1. Verify the exact accepted `main` merge SHA, successful canonical Actions check, production deployment readiness, and final release version.
2. Prepare user-facing notes **from the aggregate shipped changes since the preceding production release**, not raw commit messages. Include notable features, fixes and the production PR; avoid unreleased Preview features or internal/private metadata.
3. Confirm any existing `vMAJOR.MINOR.PATCH` tag resolves to exactly that accepted `main` SHA. Never move/recreate mismatching tags. Create the missing tag only after all gates pass.
4. Publish a **non-draft, non-prerelease** GitHub Release on that tag with notes and the real publication date. Verify it is visible in the public Releases feed; a tag alone does not populate Mosaic's history.
5. If release/tag write access or a proof gate is unavailable, report the precise missing step for a repository maintainer. Do not claim publication or invent historical entries. Never create a release as a side effect of Preview CI.

As of 2026-10-10, `main` has v0.6.2 in source, but its public Releases feed and tag list were empty. A truthful v0.6.2 release may be published only after its production CI/deployment evidence and tag target are checked; earlier releases must be reconstructed from verified evidence rather than inferred.

## Build identity and PWA

Every hosted build embeds the Vercel SHA, branch, commit message (including body when provided), UTC timestamp and channel (`Preview` or `Production`). Local builds show `local`. Settings shows only the Version label and number by default; tapping Version expands the Appwrite backend identity, Git branch/commit and message metadata. The commit message has its own nested control to reveal/collapse the full multiline body. Git identity separates builds even if no app-version bump is required. As before, service-worker install/update prompts are separate from semantic versions and offline data sync.

Deployment channels remain: `main` = Production; `dev` and stable `feature/*`, `fix/*`, `perf/*`, `security/*`, `refactor/*` = Preview. AI task branches `chatgpt/*` and `codex/*` do not deploy. The historical single `preview` branch is obsolete. See [delivery](DELIVERY.md).

## References

- [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)
- [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
