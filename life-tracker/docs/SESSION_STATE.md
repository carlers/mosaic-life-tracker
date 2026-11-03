# #1443 v0.81.8 proposed phone Preferences invalid-character row-ID repair — 2026-11-03

- Owner reports installed Production phone at v0.81.7 shows Preferences HTTP 400 and a fresh settings sync HTTP 400, while laptop sync works. Production account/local RxDB must stay intact; no clear/reinstall, no reset or backend writes. The displayed HTTP 400 alone does not identify the exact rejected request.
- Code audit found a reproducible defect: `makeSettingsRowId` uses the raw `userId_key` whenever length <=36, even for keys such as `uiColor:icons` whose colon violates Appwrite row-ID syntax. Previous legacy migration handled only oversized IDs; an invalid short ID can reach the Settings replication `getRow` before any push, returning HTTP 400. This is a plausible, not phone-log-confirmed, cause.
- Appwrite's accepted row-ID grammar also includes period and hyphen. Preserve any existing IDs with those characters as remotely valid; only truly invalid IDs (such as colon or >36 characters) can be treated as impossible-cloud tombstones. This prevents unnecessary migration/deletion of existing valid records.
- Trusted Preview receiver requires the build artifact from the *same accepted CI attempt*. A browser-contract retry passed full canonical run #41674592456 on attempt 2, but the only archived build artifact belongs to attempt 1; receiver #41675902833 failed closed. Preserve the same reviewed gate. Add a multi-row partial-failure migration regression on a fresh task-to-stable PR to create a new exact-SHA full canonical attempt, then check trusted READY before Preview handoff.\n- New v0.81.8 candidate, based on accepted Dev `75dc638c8645516135b548a4550ec2717d9d91cb`: validate Appwrite ID character/length syntax, hash invalid IDs, migrate old invalid local rows value-first before pilot, skip their impossible-remote physical deletion tombstones only, fail closed for active invalid records, and label sanitized read/create/update/pull failures for next device test. Preserve pending Preferences, other collections, owner isolation, backend/Function configuration and v0.81.7 faster PWA.
- Add deterministic ID, migration failure/retention, push-queue, and safe error-classification tests; update sync scenario matrix and version triplet. Run focused task CI, squash to stable Preview, verify canonical plus trusted Preview. No Dev/Main/Production promotion without separate explicit authorization and no claim of affected-phone acceptance before direct same-origin testing.

---

# #1443 v0.81.7 Preferences pilot repair integrated with current v0.81.5 Dev — 2026-11-03

- Owner explicitly authorized Preview→Dev→Main release for same-origin Production account testing. Original v0.81.6 stable fix `7f4577d079e3b65dfc68a922609dcbe04113f97e` has full canonical #41591901842 SUCCESS and trusted Preview READY; actual phone Preferences error remains unverified.
- Current Dev `bf230860e30e7834a2fd8aed4f7cbcf394efbafc` includes v0.81.5 PWA faster update UX and Oracle reviewed publisher pins; Main `2d9f3b14c2c341824bf8c67459daf9fa355eb2d9` still v0.81.4. Integrate the accepted v0.81.6 fix/test blob files into a **new** Dev-based task and stable Preview candidate; preserve Dev PWA/security changes and ordered version stamp. Sync cleanup is frontend-only and requires no Appwrite mutations.
- Integrated candidate v0.81.7 is a distinct combined app tree; v0.81.6 was already deployed as a standalone fix Preview and cannot be reused for the integrated build. Branch naming may retain the original source fix ID; the released app version is 0.81.7.\n- Must pass focused task check, exact new stable Preview full canonical and Vercel READY; then protected Preview→Dev PR and fresh preflight, approved merge, exact Dev CI, Vercel **stable dev alias** READY+SHA readback; then Dev→Main PR with aggregate v0.81.5+v0.81.6 release notes, protected merge, exact Main CI, Production Vercel READY and GitHub Release publication readback. No bypasses, no Production Appwrite/schema mutation.
- Device acceptance of the affected installed Production PWA remains required to establish that the original symptom is resolved. Preserve all pending offline data, and do not clear application storage. GitHub Actions is the verification shell because Vercel Sandbox quota was exhausted.

---

# #1674 Diagnostic-free v0.81.5 updater after protected Oracle trust bootstrap — 2026-11-03

- User accepted faster same-origin v0.81.3 update, explicitly requested no persistent timing/JSON diagnostics, and approved dev promotion. The Oracle Production v0.81.4 cutover was separately merged to main and independently verified READY. User completed the three-file security-only trusted publisher pin bootstrap PR #1743 to main `2d9f3b14c2c341824bf8c67459daf9fa355eb2d9`; exact-main CI #41590844203 SUCCESS.
- This task starts from newly canonical-reviewing security stable Preview `security/592-oracle-trust-pins-dev-integrated-20261103@30354b99a5853ebd2ce8db3765e8229621e076fc`, which includes reviewed Oracle CI publisher hashes and updated delivery checkpoint. Carry over **only** exact already full-canonical-accepted v0.81.5 PWA source/test/version blobs from `perf/1674-accelerated-oracle-trust-v0815-20261103@8cc279bf93a18c774ae191b7402f7c9da9d05f8a`, previous full canonical #41586979648 SUCCESS, preserving newest trusted config/docs and Oracle backend.
- Four bounded complete Workbox precache install lanes, one full-manifest activation cleanup, early guarded background update prefetch, manual joining in-progress installs, real download progress UI and version-aware update prompt retained. Persistent timing JSON/export/panel and their tests stay absent; only legacy timing localStorage key removed on upgrade. App version 0.81.5, no production modification.
- Require security stable Preview trusted exact-SHA READY and proper PR #1740 dev promotion first. Then focused task verification, new stable PWA Preview full canonical and trusted READY, protected PWA dev PR preflight, user-authorized merge, canonical dev acceptance, stable dev alias exact-SHA READY readback. No main/Production PWA release and no bypassing gates. If other dev changes landed, re-check and reconcile before any promotion.

---

# #592 Protected Oracle trusted Preview delivery after main owner bootstrap — 2026-11-03

- Owner merged PR #1743 to `main@2d9f3b14c2c341824bf8c67459daf9fa355eb2d9`; reviewed Oracle Scratch and Oracle Production exact Quality Gate producer SHA values are now accepted by trusted-main receipt. The main merge changed only allowlist, anti-mutation tests and handoff docs, not app code or Appwrite/Production settings.
- Original canonical-approved stable security source `security/592-oracle-trust-pins-dev-integrated-20261103@cf31413c8409537d3d5c46ea5f6ee5dd5a619064` passed canonical #41586262768 and dev promotion preflight #41587320190. Its original trusted Preview deployment failed closed when main lacked the reviewed SHA. The official protected stable branch does not allow direct pushes; this *task-to-stable PR* carries the documentation of that accepted bootstrap and triggers a new exact-SHA trusted Preview delivery on the already protected and user-approved source policy.
- Required remaining checks before security dev promotion: task focused gate; stable source full canonical and trusted Vercel READY on exact new SHA; fresh preflight and live dev readback; normal protected merge. Next independently ship accepted v0.81.5 PWA speedup to dev with complete tests and Preview exact-SHA READY, preserving data, user-controlled activation and all Oracle backend configuration. Do not touch main/Production, bypass rules or revive timing JSON.

---

# #592 Oracle Quality Gate pin bootstrap on current Dev — 2026-11-03

- Owner explicitly authorized completing the exact-hash trust update, PWA v0.81.5 diagnostic removal and dev delivery, without weakening checks or altering released Oracle Production.
- Actual live branches: Oracle Production main `682afcd4a5ef8871023dd4c3b801a4411d52e41a` and Dev `94a99b2a4aeaf8a17fca8a77f8de143391950aea` share an identical Git tree (the Production merge has Dev as its second parent). v0.81.4 already released; Oracle release #1731 merged. Trust security stable Preview `security/592-oracle-preview-gate-pin-20261103@a48064f76ad60c89a67d35509d5720cccbaf507e` passed full canonical #41580081204 and trusted Vercel READY. But direct main trust PR #1738 is blocked by branch protection requiring head=Dev and canonical exact source SHA, so do not override or fake checks.
- This current-Dev task carries **only** those security-tested exact allowlist source and negative-test blobs, preserving Dev Oracle code/version. Reviewed Oracle Scratch and Production workflow blob hashes are `41b277f1a335e07a9540d4d8d422856e2fc4e2a9` and `b79f65c09c83168e6c124057a775d5629ee21e07`. Do not broaden to patterns or change the workflow itself.
- Requirement: focused task check, full stable Preview canonical, exact Preview deployment readback, then approved guarded Dev→Main main-only security delivery as version-unchanged change. Note self-bootstrap deadlock: trusted default-main receiver blocks any new Oracle-workflow stable Preview until the pin exists on main; do not bypass the receiver or trust an unverified Preview SHA. Report blocker if no compliant delivery path.
- Owner-accepted PWA stable candidate `perf/1674-accelerated-clean-v0815-20261103@3a985a398d30ded2ce3386e3d84f026183330aaf` passed full CI #41579825957 but has no trusted READY deployment. Its Dev PR #1737 is stale/dirty after Oracle docs checkpoint; rebase after trust path solved. Do not touch Production PWA or the dedicated v0.81.3 test alias.

---

# #975 Oracle Production v0.81.4 release cutover checkpoint — 2026-11-03

- Owner explicitly confirmed completion and verification of native Cloud Production → dedicated Oracle Production Appwrite migration and approved the live cutover; destination project `6ae9599c002ab812f9c3` at `https://129-221-244-67.sslip.io/v1`. Keep Oracle Scratch project `6ae94a2100014d01f5ed` exclusive to Preview and Dev.
- Production Cloud source stayed live while staging; read-only total baselines after reported migration stayed unchanged across repeated checks: 6 users, 4,867 tasks, 510 messages, 43 diary entries, 141 storage files. Retain Cloud as rollback reference; record/file/Function acceptance relies on the owner's Oracle Console confirmation because connected Oracle MCP keys are TEST-scoped.
- Oracle Production candidate v0.81.4 stable Preview `feature/975-oracle-production-cutover-v0814@fe1615b34094462cc410c79d92f3a4c96a120729` was canonical CI accepted (#41577773223) and Vercel READY. Owner-approved Preview → Dev PR #1730 produced `7047fb098b5689df6f5b9069075fd73f1320ccfd` with exact accepted source tree.
- Main `aaeb7b2f6e7ebcaf74c98ea663272d9ee06a9dfd` contains protected v0.81.2 release-publisher recovery. Its three runtime/test changes are identical in Dev, and its historical checkpoint header was retained verbatim. To resolve Main merge ancestry without dropping content, a Main-aware integration Preview `feature/975-oracle-production-main-ancestry-v0814@ec21fb66da365431d7944c713818ba9227fda9bd` retained the exact same accepted app tree; full canonical #41578767659 and Vercel READY passed; Dev PR #1732 merged it as `10d2c6f4bf229997271e6086d5451975678ce6a8`.
- **Release gate:** The history-only Dev merge made zero file changes and therefore did not trigger the required path-filtered Quality Gate/Dev Stable Alias Delivery workflows. A new docs-only accepted Preview/Dev merge is required to generate an exact-SHA Dev canonical check and stable alias readback before the approved Dev→Main release PR #1731 can be merged. Do not weaken workflow path filters, forge CI statuses, force protected refs, or publish Main before gates pass.
- Main Production alias, Vercel Production configuration, Appwrite Production data, and GitHub release are unchanged at this checkpoint. After an accepted Dev merge, check Dev canonical and alias, Main promotion preflight/merge, Main canonical, Vercel Production exact-SHA READY and real build metadata, then v0.81.4 GitHub Release publication.

---

# #1678 v0.81.2 protected release-publisher recovery — 2026-11-03

- Owner explicitly approved a one-time narrowly scoped maintenance recovery, not an app version bump, MCP production promotion, or bypass of CI/production-identity checks. The live Production app is already on `main@2f4791159e8bd9e7a33cf78597ec80b10850fd0f` v0.81.2, Vercel READY exact SHA, but `v0.81.2` GitHub tag/Release absent due to Vercel project-scoped status context.
- Copy only the already reviewed and protected-dev-accepted release status helper, trusted publisher use, and negative/positive regression tests from `dev@8dd7120479e02bbc3f92ec8c5a0c5c05c913dc27`. Application source, package version, Product backend, feature flags and unrelated MCP code unchanged.
- Isolated `main`-based task branch must pass focused tests; promote through accepted stable Preview, full exact-SHA canonical and official Vercel READY. The existing required `promotion-pr-preflight` rejects non-`dev` heads, so the actual one-time rule exception needs an owner-controlled equally guarded policy before any `main` merge. Do not bypass it or report GitHub Release done until actual trusted publisher success and readback.
- The pre-existing same-version recovery path requires an immediately adjacent, two-parent verified main maintenance merge, original accepted notes/source, identical second-parent tree, only publisher/test/docs allowlist, exact successful main canonical CI and Production deployment identity. If any condition fails stop. Preserve original Production Function, backup, previous READY deployment and disabled destructive features.
- No Production or protected branch mutation is authorized merely by this branch checkpoint.

---

# #1678 Production release publisher status context fix — 2026-11-02

- Owner accepted and approved main release v0.81.2, merge #1698 `2f4791159e8bd9e7a33cf78597ec80b10850fd0f`. Protected preflight #41482853793 and main Quality Gate #41483826298 attempt 2 SUCCESS; Vercel Production READY `dpl_EAFoYAaB5FqyDXDrgjMu3Q77rAeM`, public alias points to exact main SHA.
- Trusted Publish Production Release run #41485645184 FAILED 12/12 after independent live Production meta verification succeeded: `assertProductionEvidence` expects legacy commit status context `Vercel`, but GitHub now reports scoped `Vercel – mosaic-life-tracker` SUCCESS and unrelated `Vercel – mosaic-project-site` FAILURE. Thus no `v0.81.2` tag or Release exists. Do NOT spoof GitHub statuses, retag, bypass the publisher or weaken the production identity check.
- Scoped source fix: accept only the historical generic context or **exact** Mosaic scoped context with SUCCESS and trusted URL prefix; reject unrelated project, failed/pending statuses and wrong URLs; reuse same matcher in historic bootstrap guard. Add regression for actual dual-project statuses, keep product version v0.81.2 and Production backend/Function unchanged.
- Task on current protected dev baseline `8ef4e275e525d3d2157393ffb888f1549af5efec` due concurrent accepted read-only MCP changes after released v0.81.2. **Important:** the next same-version release recovery whitelist only permits approved workflow/docs/test files and a main merge with unchanged accepted application tree. Current dev includes additional MCP files, so do not silently promote its entire tree to main as a v0.81.2 repair. Follow protected task→stable Preview→dev and resolve an explicitly compatible main recovery path; stop if main preflight or release recovery cannot be satisfied.
- Production source stays live; v0.81.2 GitHub Release remains pending until trusted publisher succeeds with current approved source. Refs #1678 #476 #592.

# #1703 MCP Production guards reconciled with latest dev (2026-11-03)

- Current dev `1327a6316ac5223738bacb4b74c63a3a5c9dba11` includes already accepted Scratch MCP via PR #1708 and later guided tour v0.81.2. Existing task branch `chatgpt/1703-mcp-production-guards-20261102@30c479ce880f3f0728a658389446fdde51ad8e7d` passed focused CI #41479592099 but was based on pre-tour dev. Its stable Preview branch creation was **rejected by connector safety checks**. Never use direct task-to-dev/main or bypass that control.

- This new task branch starts from exact live dev and overlays **only** the audited `life-tracker/mcp-server/**` subtree and `docs/MCP_PRODUCTION_ROLLOUT.md` from the verified guard commit. This preserves the guided tour, v0.81.2 version, root manifest, and all unrelated source. No Production, dev, or main modification is authorized by preparing this task commit. The separate Production `mosaic-mcp-prod` Vercel project remains disabled, missing its own read-only API key; Production Appwrite SG OAuth server disabled with no scopes or consent URL.

- Guard source fixes Scratch/Production issuer and project isolation, separate regional JWKS/introspection/repository routing, production-only enablement and unconditional write denial, deployment-specific OAuth discovery metadata and consent origin, and negative cross-environment tests. Promotion requires a **new authorized stable Preview branch** based on current dev, task-focused CI, squash-merge, canonical CI, independently READY Preview, read-only promotion preflight, then approved dev progression.

- Important residual risks before live Production activation: current MCP per-owner rate limiter is in-memory/per-instance (not a distributed enforced quota), Production OAuth provider parity and independent key not established, and production owner-private two-account login/revocation/device acceptance not performed. Fail closed; do not enable Production MCP until all pass.

---

# #1675 Dev-based guided tour integration — 2026-11-02

- Owner authorized merging the accepted guided-tour app work to dev and requested an improvement review. Direct stable tour Preview at 297be23078bd76594df7e1381b670240ca86944d is **diverged** from live dev 2e7c566e2207dafcf2a89b93a4dfdf04f0974d01; do not merge that stale tree to dev.
- Dev-based integration carries only the accepted v0.81.2 frontend tour engine, account-scoped first-run invitation, replay entry in Settings/About, calendar target anchor, placement/progress modules and regression tests; retain all newer dev HomePage/Settings and MCP-only 1703 integration. Frontend version advances from dev v0.80.2 to accepted tour v0.81.2. No Appwrite migration, demo/public landing merge, main, or Production change.
- Further improvement audit: consider explicit pause/resume when users navigate to other screens; avoid hidden focusable controls behind sheet overlays; review accessible keyboard focus order of nonmodal tour; improve guidance for category-less users and friend-view switching; add true mobile-device Android Back and multi-sheet manual testing. These are follow-up design/test candidates, not unverified release requirements.
- Workflow: focused task branch verification, squash to new dev-based stable Preview, full exact-SHA canonical CI and official Vercel READY, read-only promotion preflight, owner-authorized stable Preview->dev PR and protected checks, exact-sha dev deployment/alias verification. PWA service-worker install is separate manual acceptance.

---

# #1703 MCP-only integrated Preview delivery on current dev — 2026-11-02

- Owner approved release progression conditional on documented gates. Older MCP stable Preview `95c45e155faa3e1236cba81732136a594424d4ba` is based on v0.56.0 and diverges from current dev `fe16f4c156501685b125354447499e2b40390455` v0.80.2 (16 Preview-only and 53 dev-only commits). Direct promotion is ineligible due to tree/version drift. No dev/main/Production push performed.
- New isolated task and stable Preview branches start from exact dev SHA. Copy only the accepted standalone `life-tracker/mcp-server/**` subtree from MCP SHA (tree `92d4a6268e0bf21116ea2af23bf537f1bc3474cb`), preserving dev app code and version. Attach sidecar locked test/build to existing unit CI and focused detector; version impact NONE to frontend, because no Mosaic PWA UI route/features change. Add rollout gates in docs.
- Production Appwrite project `6a9703c50016b37110ff` (Singapore) has OAuth2 server DISABLED, zero custom scopes, empty consent URL. Scratch `6a96e82d000d1310b3be` (Frankfurt) has OAuth enabled and passes two-user JWT/introspection/revocation/isolation. Current MCP is hard-pinned to Scratch project, issuer, repository, resource metadata and consent page; cannot safely activate in Production by changing env vars. Production-specific host/issuer/config, separate read-only key and provider parity must be implemented/tested first.
- New stable Preview branch `feature/1703-mcp-readonly-integration-preview-20261102` created from dev; task branch `chatgpt/1703-mcp-readonly-integration-20261102`. After focused check and security review, squash into new stable Preview, verify canonical CI and READY, and run read-only promotion preflight before dev PR. Do not promote to main or enable Production until independent Production release gates pass. Oracle #975 readiness unresolved.
- Scratch MCP alias and connected ChatGPT plugin remain unchanged and operational. `MOSAIC_MCP_ALLOW_WRITES=false`. No user data or keys touched.

---

# #1673 Signup copy refinement and dev integration — 2026-11-02

- Owner accepted mandatory username + email/password signup and automatic login from v0.80.1 Preview at feature/1673-auto-signup-v0800-20261102@72af71712ce01bbb52f4ef86fec51eb9e3bf5e86. Requested removal of signup password-hint sentence “You'll be signed in automatically.” and authorized merge into dev; not main or Production.
- Reconcile onto current dev@5abef02ee462dd730da0516ec11e589f42fcfcc6, preserving newer #1678 release compatibility and category lifecycle schema/serialization checks. New user-testable Preview v0.80.2 retains “At least N characters.” password guidance, username profile uniqueness, account isolation and immediate post-signup session, with no Scratch/Production backend mutations.
- Required gates: isolated focused tests and canonical verification, task focused CI, dev-based stable Preview canonical and trusted exact-SHA READY, read-only promotion preflight, owner-authorized stable Preview to dev PR and canonical acceptance, exact dev official Preview READY and stable dev alias readback. Device PWA service-worker activation is manual.

---

# #1678 Production category flag manifest / old-client ACL gate — 2026-11-02

- Read-only Appwrite Production/Scratch comparison found table-level create grants `create("users")` for Production `tasks`/`categories` (Git manifest matches) but empty grants on Scratch. Immutable published v0.50.3 still invokes direct createRow for tasks/categories; deleting Production create grants could break queued old writes. Existing new dev code uses owner Function with a direct fallback. Do not copy Scratch grants to Production; separately prove old-writer compatibility, safe category deletion and account isolation.
- Scratch Function uses `CATEGORY_DESTRUCTIVE_ENABLED=true` as a gate; Production deliberately has no variable and no approval to enable it. Git portable Function variable contract did not include the Scratch optional variable. Add `CATEGORY_DESTRUCTIVE_ENABLED` to optional non-secret allowlist only (no default, no value, no Production/other Appwrite changes) with contract regression; keep absent Production as disabled.
- v0.50.3 exact source pin and first managed category lock migration 024 already on `dev@c47d8208487cb81f41b47866ea4f6a753f5bf368` (canonical #41458639676 and stable dev alias #41458639670 PASS). Follow task/Preview/dev for this source-only hardening; Production/main still need separate explicit approval. Refs #914 #1186 #1678.

---

# #1678 Category lifecycle schema/serialization gate — 2026-11-02

- Reconciled onto accepted `dev@1cc15f3750eac896c6771599961922a8d07f2cfc` (v0.79.0) containing separate release client compatibility pin #1678/#914. Live category lifecycle Function queries/updates `categories.lifecycle_state` and `lifecycle_target`, which were omitted from the Git manifest and Production. Scratch has exact optional varchar(64) defaults empty. Repair manifest, add ordered idempotent additive migration `024-category-lifecycle-lock`, and update source mapping to recognize but strip these server-owned columns from strict local RxDB; never emit them in client writes.
- Test missing, existing, incompatible and failed columns, sync serialization, historical v0.29.1/v0.50.3 source consumers, production backend contract/CI. Scratch already has the two columns, but no backend writes or cross-account live/PWA tests are authorized or verified by this source task. No version bump.
- Task → stable Preview → approved dev; production schema/Function, device acceptance, and final main release remain separately gated. Refs #1186 #857 #914 #1678.

---

# #1678 Pre-1.0 release backend compatibility pin — 2026-11-02

- Scoped release-readiness task based on `dev@c44a2c8b02e058cae7e8a8bcd02d14e0a786775a`, Production `main@8cdfdf8573ded70b37db1c4b7a49e1d86d5ace89` (v0.50.3). Source compatibility policy still pinned only v0.29.1, although current Production installed PWA is v0.50.3; add exact latest shipped main to historical consumer policy, retaining v0.29.1 as extra guard. No version bump, code runtime change, provider write or Production authorization.
- Exact-SHA independent read-only compatibility diagnostic against both v0.29.1 and v0.50.3 checked the same eight subscribed collections, reporting 0 source-level errors; live Appwrite writer/permissions, offline, delayed service worker and devices remain UNVERIFIED.
- New isolated Node 22 Vercel Sandbox `mosaic-1678-readiness-v2-20261102` succeeded after prior sandbox creation errors. Run focused compatibility tests and contracts before task PR, then canonical stable Preview and protected dev acceptance. Do not merge to main or migrate Production without separate explicit approvals; broader release coordination in #1678.

---

# #1663 Dev alias Vercel discovery fix — 2026-11-02

- Owner enabled `dev` in GitHub `mosaic-preview-auto` deployment branch policy. Previous failed run #41397049864 attempt 1 had zero steps due protection. Agent reran only failed job: attempt 2 started successfully, passed exact-SHA canonical verification, but failed at 2026-11-02T06:31:56Z with `No matching READY dev Preview deployment` after the /v6/deployments filtered listing returned no accepted candidates for its Vercel token. External Vercel plugin separately verified official deployment `dpl_7nWVpWBaFm6TzGd3MsnEsLTFVY97` READY on `dev@b1856f8237dd392c7a43db11339bc459ae2f7d01`; the stable alias is already correct.
- Current isolated repair `chatgpt/1663-vercel-status-discovery-20261102` changes only the standalone automatic dev workflow and security test plus docs. Discover exact deployment from Vercel-signed GitHub commit status context with tightly allowlisted target URL, then fetch `/v13/deployments/dpl_ID` and check official project, Preview, Git SHA/branch, READY before idempotent alias reconciliation. Give workflow GitHub `statuses: read`. No Quality Gate, backend, Production or app version changes. Focused task, stable full canonical, trusted Preview READY, protected dev PR and real post-merge automatic successful run/readback still required.

---

# #1663 Trusted Preview safety repair — 2026-11-02

- The first automatic alias candidate on stable `feature/1663-dev-alias-automatic-delivery-20261102@712734ff778c0ea1235e341958f69fe336155dfa` passed focused CI #41395143058 and full canonical #41395469227, but trusted-main Preview receiver #41395898834 properly blocked the modified Quality Gate definition (`Unreviewed generic Quality Gate definition`). No Vercel Preview of that candidate was accepted.
- Current repair `chatgpt/1663-trusted-separate-dev-alias-workflow-20261102` restores Quality Gate byte-for-byte and relocates the fixed dev-only alias reconciliation into its own workflow. The dev-push job waits for successful exact-SHA canonical CI before Vercel token use, checks live HEAD and official Preview deployment and only the allowlisted dev alias, retries boundedly, and verifies after-write mapping. No app/Production/backend change. Repeat focused task, stable full canonical/trusted Preview READY, protected dev PR and post-merge automatic job acceptance; no main promotion.

---

# #1663 Automated dev PWA alias delivery — 2026-11-02

- Owner approved completing the dev stable-PWA delivery standard and automation, excluding unapproved main/Production changes. Read-only verifier and docs already promoted to `dev@b3f4d37957de74ae9c1b82ad18dc63f168882554`, exact accepted tree `191091b2538776168802782bd1e9c273cd009321`. Dev canonical Quality Gate #41394485093 success and Vercel `dpl_BCAyEPhh7PsAjzmrppuiznHMFCpz` READY, stable alias read back mapping to exact SHA after guarded repair.
- Current isolated follow-up `chatgpt/1663-dev-alias-automatic-delivery-20261102` implements a protected `dev`-only postcanonical Vercel alias reconciliation job with fixed inline Node and no candidate source checkout; bounded READY retry, exact project/ref/CI/metadata checks, current-head checks before/after write, alias readback, fail-visible status. Existing environment secret is referenced but never logged. Add security contract regression, run task focused CI, then stable Preview full canonical and trusted Vercel READY, merge to dev after read-only promotion preflight and verify live job succeeds. No main/Production/backend writes, version remains v0.79.0.
- Agent/device PWA service worker activation remains separate manual verification. Preserve other queued dev work and stop/reconcile if dev SHA advances.

---

# #592 Stable dev PWA alias mismatch and verification standard — 2026-11-02

- After approved #1026 v0.79.0 promotion, dev `9b78f9127f3556ee6291b0dac927222c34a01d39` passed canonical CI and Vercel deployment `dpl_4Q2PeKajRHuJVvjyGeF7rdcT4w6e` READY, but stable PWA alias `mosaic-life-tracker-git-dev-carls-projects-72516fde.vercel.app` still mapped to v0.78.0 `dpl_E9g9hcPQN4yhqqxa5TNMxzhpjHbS`. Root cause: delivery completion checked immutable build READY, not stable alias mapping; why Vercel failed to auto-retarget is not established.
- Guarded Vercel dev-alias reassignment was executed and read back to exact v0.79.0 deployment. No main/Production/backend changes. Client PWA service-worker activation remains device-specific.
- Current task: standardize exact `dev SHA → canonical CI → READY Preview deployment → stable dev alias` chain with reusable read-only script, fail-closed regressions, AGENTS/delivery policy. New version impact NONE; work isolated on `chatgpt/592-dev-pwa-stable-alias-gate-20261102`. Complete focused CI then stable Preview full canonical; no automatic dev/main merge for this tooling change.

---

# #1026 Capability profile/social isolation batch v0.79.0 — 2026-11-02

- Base accepted dev 764a0841d68e55e90cdca4d7a909dbc442195d26 includes concurrent storage/media lifecycle changes v0.77.0. Owner approved one combined batch for core-only build ceiling, social pilot shutdown, personal single-user preference, operator diagnostics and automated acceptance. Preview-only; no dev/main/Production promotion is authorized by this request.
- Immutable full/core-only capability manifest defaults to full Appwrite and fails closed for social on unknown build profiles. Remote operator flags and owner-scoped synced Settings/local mirror can further suppress social. No backend/Supabase cutover or ACL changes.
- Preferences / Privacy & Social provides owner mode, lazy settings hydration and a read-only searchable internal diagnostics component. Sync coordinator excludes Friends/Messages in solo mode, cancels their pilots/realtime, pauses message/social outbox dispatch and new push re-registration without deleting local records or sync cursors.
- Limits: client flags do not revoke existing Appwrite permissions, in-flight operations, shared Tasks collection rows, or existing server push endpoints. Device ON/OFF, cross-device, offline cold-start, OS push and provider-side acceptance remain manual. See CAPABILITY_PROFILES.md.
- Next: local Node22 focused DOM/unit, contracts, both normal and core-only PWA/build-size. Publish exact-tree task focused CI; squash stable Preview, full canonical Quality Gate, trusted Vercel READY. No Production writes.

- Reconciled with current dev v0.78.0 Category Recovery/Recently deleted and related backend migrations. Release version is now 0.79.0. Keep Category Recovery intact; no Production actions in this batch.

---
# #857 Category lifecycle v0.78.0 integration on latest dev — 2026-11-02

- Owner accepted stable v0.77.0 feature/857-deleted-filter-v0770-20261102@0631b72f17995750b8751c5e48e5012e0de59dbc and authorized dev promotion. Current dev separately advanced to storage v0.77.0 ad54842396cc1717f265135c142e1ded56adaa1c, requiring a distinct v0.78.0 reconciled Preview; do not promote original identical-version divergent tree.
- Carry accepted fourth Recently deleted filter, exact-name recovery, server category marker and additive migration 021-category-recovery onto storage-integrated dev. Retain existing 022-media-uploads, 023-synthetic-media-delete, media ledger and all Scratch/Production controls. Resolve the three conflicts in migration list, expected order and session metadata; no other source conflicts.
- Local reconciled verification PASS: 128 focused DOM/handler/backend-contract tests, scoped ESLint, version/contracts, TypeScript/Vite/PWA and blocking size budgets (Home 375787/381000 gzip). Need focused GitHub CI, v0.78.0 stable Preview canonical and Vercel exact-SHA READY, then guarded owner-approved dev promotion and post-merge verification. No main/Production or Scratch provider mutation.

---

# #1478 Storage management — accepted manual test, dev-forward v0.77.0, 2026-11-02
- Owner accepted the verified v0.75.0 Storage Preview and explicitly authorized promotion to dev. Previous accepted stable Preview feature/1478-storage-dev-integrated-v0750-20261102@86c8d9c4061defeb845674cb17d8de25cbffcfef passed canonical #41343708955, Trusted Preview #41344075343, Vercel READY and 21 live Scratch synthetic cleanup checks. All disposable test data was removed.
- Reconcile the storage source onto current dev b952063a615700addeecd4c9e1db432a84cf2242 v0.76.0, preserving all 43 operator feature controls, global social-off mode, newer bottom sheets, and category security. Stamp integrated Preview version 0.77.0. Use focused CI then stable Preview canonical/Trusted delivery, guarded dev promotion with accepted tree and required CI. No Production/main changes.
- Storage deletion remains limited to explicitly user-confirmed new server-verified tasks/Diary/profile media with grace, cross-reference checks and private receipts; no automatic sweeping, no legacy/unknown/chat media deletion. Offline stale-reference replay is not proven safe for all cases; users must be told this limitation prior to any Production release. No current feature expansion is implied by dev promotion.
- Scratch is a shared runtime with concurrent feature development; verify active Function source and 13-column ledger before any backend update; do not replace the currently active newer Function with older isolated source. Existing approved Scratch runtime must be preserved.
---
# Storage management #1478 — v0.75.0 dev-forward integration, 2026-11-02

- Owner authorized finishing storage management after the v0.72.0 isolated Preview accepted, Scratch message-action active deployment 6ae7801f1c827c860c3f READY, canonical #41334937982 SUCCESS, and independently run 21-check live Scratch three-account/new-media/grace/receipt acceptance PASS. Disposable users and test ledger row subsequently removed; existing media/Production unchanged.
- Integrate v0.72.0 owner-confirmed new-media cleanup and proven ownership ledger onto dev@8dc5074c33250a5d9a449aad4c486fab489e8448 v0.74.0, preserving newer global bottom sheet and category ACL hardening. Distinct migrations 020-category-retirement, 022-media-uploads, 023-synthetic-media-delete; Scratch schema exists already and is not rebuilt. New user-visible Preview version 0.75.0.
- Run focused tests and canonical full CI and trusted Preview on the integrated exact source; check shared Scratch active Function parity before any server-side rollout. No Production/main or automatic file sweep. Legacy/unknown files remain protected; older PWA support expressly excluded by owner.
- Remaining: reconcile checked test/CI evidence and manual device acceptance. Do not claim actual Android/iOS hardware checks without a device.
# #1026 Feature controls — dev-integrated v0.76.0 (2026-11-02)

- Integrate the accepted 43 PostHog opt-out feature controls and global social-off mode from stable `feature/1026-solo-command-hardening-v0740-20261102@329c41ed743d9fbefdb523d8e4c0d362a0a74a5e` (tree `2b194fdb15da347636077c1166184649914a3bd0`) onto dev baseline `8dc5074c33250a5d9a449aad4c486fab489e8448`.
- Dev has independent v0.74.0 category lifecycle/discoverability and shared BottomSheet changes; preserve and reconcile Category Manager filters, reorder constraints, new lifecycle actions and the operator reorder flag. Version collision resolved by allocating 0.76.0. User expressly approved Preview acceptance and dev promotion, not main or Production.
- Next: focused integration/regression tests, contracts, Node22 PWA/size, exact-tree task focused gate, fresh stable full canonical/trusted Scratch Preview, read-only guarded promotion preflight and dev PR/CI/Vercel READY. Manual device ON/OFF acceptance still not performed; remote master mode remains client-only, not provider capability or security enforcement.
- Separately track immutable provider-aware offline core-only profile, pause of social replication/push/realtime and safe cursor lifecycle; do not silently enable that high-risk mode on dev or Production.

- Version adjusted to 0.76.0 after detection of independent active storage Preview v0.75.0; feature source unchanged.

---

# Universal scroll-aware BottomSheet v0.74.0 — version collision reconciliation (2026-11-02)

- Previous v0.73.0 stable Preview `feature/universal-sheet-pull-v0730-20261102@9a5f2deb271d236695e5b7e8a0a7f24403450598` passed focused run #41337496807, canonical run #41337846522 and trusted Preview #41338196300. Exact-SHA Vercel deployment `dpl_EHV4Zzs8CYRtxRE8eQdLyqPsfhKK` READY. Another concurrent stable feature `feature/1026-chat-alerts-controls-v0730-20261102` independently published the same v0.73.0. Preserve the accepted implementation but assign the next unoccupied line v0.74.0; the v0.73.0 branch must not be promoted.
- New task branch `chatgpt/universal-sheet-pull-v0740-20261102`, new stable `feature/universal-sheet-pull-v0740-20261102`; version-only change in package/package-lock/appVersion plus this checkpoint. Require fresh focused and full canonical exact-source + trusted READY. Scratch/Production schema unchanged. Manual Android/iOS acceptance and dev promotion remain gated.

---

# Universal scroll-aware BottomSheet dismissal v0.73.0 — 2026-11-02

- User authorized extending Day View pull-down-to-close to standard bottom sheets globally. Base `dev@62a839fb4c2d22f1a77ee357f797df4ed19f98c8` v0.68.1; isolated task branch `chatgpt/universal-sheet-pull-v0730-20261102`. Planned Preview v0.73.0 (v0.69–0.72 active feature lines); confirm no later version conflicts before publishing.
- Shared BottomSheet captures one-finger downward touch at the initial top of every nested vertical scroll owner, follows finger via Framer Motion y value, spring-restores a short pull, and routes confirmed dismissal through existing stack/history. A touch beginning mid-scroll remains native for its entire lifetime; upward/horizontal intent, header drag, reorders, editors, stacked sheet locks and opt-out content retain ownership. All content modes, including Day View's nested scroll body, participate; no Appwrite/data/backend changes.
- GitHub-connected implementation and browser regressions; Vercel Sandbox creation is blocked by account snapshot-storage Hobby quota (HTTP 402; resets 2026-12-01). Use GitHub CI for focused and canonical gates. Pending: focused [verify:browser], stable Preview squash/merge, canonical gate, trusted Scratch Vercel exact-SHA READY, and manual Android/iOS gesture acceptance. Do not promote to dev/main/Production without explicit approval.

---

# #857 Category Manager discovery and filters v0.68.1 — 2026-11-02

- User approved next user-visible category-lifecycle refinement after approved `dev@5c29f7d32b140ff1c1130a6235e8e9736acc2524` v0.68.0. Scope is **frontend only**: Day View three-dot category menu gains context-specific `Manage category…` action, opening the same lazily imported Category Manager with that category’s inline edit form expanded and scrolled to; Preferences → Tasks & Categories gains a separate `Manage categories` row; Category Manager adds All/Active/Retired filters, case-insensitive search, zero-match state and reorder protection during filtering.
- Active/Retired classification follows date-effective retirement: a category is retired when its inclusive last-active date is before the owner’s current local date. Future scheduled retirement stays Active. Original full-list ordering and reverse controls remain available under `All` with empty search; filtering never rewrites hidden-category order. No task/category server or RxDB changes.
- Task branch `chatgpt/857-category-discoverability-v0681-20261102`; version 0.68.1 set in three files, regenerated component index, Settings search index updated. Targeted 80 category/settings/reorder DOM tests initially green; targeted shortcut and semantic tests added; ESLint with eight pre-existing DayViewSheet hook warnings, no new errors; contracts/version and TypeScript/Vite/PWA blocking size checks green. Final focused GitHub CI, stable v0.68.1 canonical acceptance/READY Preview and owner manual device acceptance still required. No dev/main/Production promotion authorized for this refinement.

---

# #857 Category lifecycle accepted Preview integrated with dev v0.67.0 — 2026-11-02

- User explicitly approved category lifecycle #857 for dev. Accepted stable Preview `feature/857-category-retirement-v0560-20261101@052202b1e0794cef5ea39b86a93b10958f91d335` v0.56.3, full canonical #41323791699 SUCCESS and exact-SHA Vercel Preview READY. Signed Scratch two-account acceptance: 14-task resumable move, Delete-All and empty-category deletion, cross-owner denial, ACL cutover verified; synthetic records cleared. Shared active Scratch Function deployment `6ae765943b465ba13e8c` READY, gate enabled; Production untouched.
- Live dev advanced independently to v0.67.0 `e0094b386d47bcdb02a2bc69c57d02a10935db7c`; direct category Preview promotion is divergent and would regress version. Preserve newest dev messaging/photo/bug-report features; integrate the accepted category branch in isolated v0.68.0 Preview with unique Appwrite migration id `020-category-retirement` (existing dev 016–019 reserved). Run focused unit/handler/DOM and full PWA size, canonical exact-SHA and trusted Vercel Preview. Promotion to dev is authorized, main/Production are not. Integrated tree needs new Preview verification before promotion.
- Keep destructive category operations source-controlled. Do not independently deploy the merged older source Function to Scratch: current live shared media-safe Function is separately verified. Manual device acceptance of integrated dev still remains separate.

---

# Issue #1026 — optional chat initiation controls v0.67.0 (2026-11-01 Asia/Manila)

- Owner completed v0.66.0 manual flag testing and explicitly approved promotion to `dev` and continuation. Stable `feature/1026-safe-initiation-controls-v0660-20261101@12aa12dfe4fffcd4353093c1e7634be7aef0a884` accepted via focused #41312035664, full canonical #41312320442, trusted Preview #41312668961, and protected promotion preflight #41318187620. PR #1593 merged to `dev@53c70b9f26ce5ad835adcd35f0152705679cf824`; accepted source tree identical, exact-SHA dev Vercel READY. No `main` or Production promotion.
- Current isolated v0.67.0 task branches from exact dev SHA. New PostHog disable keys: `mosaic_disable_chat_photo_upload`, `mosaic_disable_chat_reactions`, `mosaic_disable_chat_sticker_sending`. UI presents optional controls only when enabled; handlers recheck before new photo staging, reaction mutations or pack/GIPHY sticker sends. Historical incoming/outgoing photos, queued message delivery, rendered reaction badges, sticker payloads and ordinary text/reply/unsend actions remain unaffected. Flags remain client presentation/initiation only, not permissions, revocation or backend capability.
- Node 22.23.4 sandbox: six focused test files 14/14 passing (including new chat-control UI/hook and photo-staging guard), zero changed-file ESLint errors (one unrelated existing ChatPage dependency warning), `version:check` and `contracts:check` passing, production/PWA/size build passing (Home closure 380389/381000 gzip bytes). No backend/schema/Function changes and no PostHog state changes yet.
- Next: scoped `[verify:focused]` task commit and focused CI, squash onto fresh stable v0.67.0 Preview, full canonical and trusted exact-SHA Scratch Vercel READY. Only then create three unique inactive PostHog Preview flags and read back all flags. User device testing is required before v0.67.0 can be promoted to dev; never promote to main/Production without a separately explicit authorization.

---

# Feature flags #1026 — three safe initiation controls v0.66.0 in task verification
Updated: 2026-11-01 Asia/Manila

- 18 previously owner-tested reversible controls promoted to `dev@a3e2045336c57c18392f87da48f63ddf95f6bd30` v0.65.0 by approved PR #1589. Source tree identical to stable Preview `c34f7c36e8441bd203fd604c06c4c65a88fcb0ca`; postmerge Quality Gate #41311108213 succeeded, exact `dev` Vercel READY. Emergency RxDB DB6 v5→v6 migration preserved. No main/Production change.
- Next isolated v0.66.0 batch based on exact new dev tree: `mosaic_disable_bucket_list_creation` (prevent new aspirations, preserve existing), `mosaic_disable_friend_requests` (block new sends before offline queuing while letting already queued requests flush and existing friends/accept/cancel/block remain), `mosaic_disable_push_enrollment` (reject new device subscriptions before browser permission prompts while permitting existing subscriptions/opt-out and Alerts). Flags are operator initiation-only controls, not service shutdown, revocation, auth or backend capability.
- Changed UI entry points and direct command boundaries, independent typed registry, data-preserving operator docs and regressions; no migration, existing record deletion, background sync changes, remote PostHog creation/activation or service mutations. Version v0.66.0. Run local targeted tests, lint, Node22 build and size; then task focused CI, stable exact-SHA full canonical, trusted Scratch READY. Register only three distinct INACTIVE flags after validated Preview delivery and request owner test; no dev/main/Production promotion of this new batch without separate approval.

---

# Feature controls #1026 — v0.65.0 reconciliation after emergency DB6 recovery
Updated: 2026-11-01 Asia/Manila

- Owner completed four-control manual testing and explicitly approved `dev` promotion plus further feature work. Previous v0.65.0 Preview `7a2eb50d7f592794c47857abf411c4c6c340997e` passed full canonical #41303993224, trusted Preview #41304252193 and exact-SHA READY Vercel, but `dev` advanced to emergency RxDB message schema fix v0.64.1.
- Rebase on exact protected `dev@027bf023b975655e73ffb14a3f83e39a36d08563` v0.64.1. Preserve message v5→v6 schema migration, offline queued-chat-photo repair, earlier chat photos and public bug reports. All 14 carried-over optional flag code/test/operator-document blobs match the previously accepted v0.65.0 Preview byte-for-byte. Version set to 0.65.0 in all three files.
- Local ephemeral Vercel sandbox Node 22.23.4: 26 focused unit/DOM tests passed (including emergency metadata/Diary tests), changed-file ESLint zero errors and eight existing DayViewSheet hook warnings, contracts/version passed and full production PWA build/size passed (Home closure 380133/381000 bytes). No remote PostHog state was changed and no backend schema or Function modifications.
- Next: `[verify:focused]` task commit, fresh stable exact-SHA full canonical and READY trusted Scratch Preview; then approved protected Preview→dev promotion only if preflight passes and the DB6 incident rollout gate remains safe. Never modify main/Production. The emergency dev alias rollback must not be inadvertently overridden without recovery verification.

---

# Emergency recovery — RxDB messages DB6 (2026-11-01)

- Dev v0.63.0 introduced chat photo fields on the messages collection at schema version 5, changing the schema hash without a required version bump; v0.64.0 retained the regression. Older devices fail startup with RxDB DB6.
- Emergency Vercel dev alias was reassigned to the existing READY v0.62.0 deployment (SHA 8dccaddc8d5045b96b18e81dc818c84af3db28d6). GitHub dev HEAD remains 67289fe56f7f78631e325a7d2e98b7eed768f176; direct update was blocked by branch protection. Do not clear local app storage.
- This v0.64.1 fix increments messages schema to 6, supplies the v5→v6 data-preserving migration, and adds regression tests for old and queued-photo rows. No backend migrations or Production changes. Complete task focused verification, canonical Preview, and Vercel READY before protected dev promotion; do not replace the temporary dev alias early.

---

# Task checkpoint — #854 integrated public bug reports v0.64.0 on latest dev baseline
Updated: 2026-11-01 Asia/Manila

- Owner confirmed public GitHub bug reporting working on mobile and authorized adding an internal-reference copy icon and promoting to dev. Merge the full accepted bug report capability, not just the icon, while preserving newer work.
- New baseline dev@f00c0dd63c9a6907c320db267d9a9d4dfbd97d5b (v0.63.0) includes accepted private chat photos; accepted bug-report Preview@eab8ead35ad67dac7320c672ce6ece16969b9c76. The reconciled v0.64.0 candidate retains migration 017 chat photos, 018 private reports and 019 public GitHub receipt, both chat photo orphan cleanup and private report expiry, and newer dev handlers/schema.
- Confirmation UI adds an accessible copy icon for the exact internal reference, success checkmark and visible error on clipboard failure; public consent and private diagnostics handling unchanged.
- Gate: 48 focused unit, 20 handler, two copy-icon DOM tests, lint/contracts, production build and PWA size from previous dev baseline passed. Re-run on latest baseline, focused task CI, canonical exact-SHA stable Preview and READY Vercel. User already approved Preview to dev, but merge only exact verified integration without losing newer dev data. Main and Production remain untouched.

---

# Current task: #1460 accepted chat-photo feature on latest dev v0.63.0
Updated: 2026-11-01 Asia/Manila

- User accepted chat-photo v0.46.1 and authorized dev promotion. Previous v0.59.0 integration at stable Preview `feature/1460-chat-photos-dev-integrated-v0590-20261101@82730953df66301ed664e7949ef0554bee8511c5` passed canonical #41293693312 and Vercel READY but could not promote because dev advanced from v0.58.0 to v0.62.0.
- New dev baseline `8dccaddc8d5045b96b18e81dc818c84af3db28d6` v0.62.0. This candidate merges the canonical passed v0.59.0 source atop v0.62.0, preserving all later feature controls, bug reports and Home/UI code; version now v0.63.0. No Production/main change.
- Requires fresh focused and full canonical CI, Scratch-only Preview Vercel READY, read-only Scratch deployment/feature-scope proof, and manual acceptance of changed integration tree before stable→dev promotion per DELIVERY.md. No backend writes required. Do not claim unperformed device/ACL tests.
- Issue: https://github.com/carlers/mosaic-life-tracker/issues/1460.

---

# Task checkpoint — #1026 accepted 14 control registry dev reconciliation v0.62.0
Updated: 2026-11-01 Asia/Manila

- Owner explicitly accepted all seven new P1 feature switches on Preview and authorized integration to dev, not main or Production. Prior six controls already in dev v0.54.0; TodoMate v0.55.0 and seven further non-destructive switches v0.57.0 require forward-porting.
- Accepted source Preview `feature/1026-p1-seven-controls-v0570-20261101@d618bbe05b378d13dda1ea0d51910719fd990ba1`: canonical #41234343819 success on attempt 1, trusted Preview delivery #41234684743 READY, exact Vercel deployment verified. All 14 flags in PostHog 619969 registered inactive and read back, zero behavior disabled.
- Latest dev baseline `50d5afb2cf7d04c3739a482736b815008eea1405` v0.58.0 includes later diary-quote privacy features; preserve `useDiaryReferencePreviews`, reference authorization and quote redaction. Other flagged files match earlier dev baseline and can be adopted exactly from accepted Preview. ChatPage retains the new dev source and updates only two flag calls to exact strings.
- v0.59–v0.61 candidates are reserved by concurrent Chat photos/storage/bug-report work. Choose free v0.62.0 for isolated integration Preview; synchronize all version files. No new flag creation or rollout mutation in this integration.
- Run task focused CI, squash onto stable `feature/1026-registry-dev-integrated-v0620-20261101`, exact-SHA full canonical + Home size budget + trusted Vercel READY, read-only promotion preflight and explicitly approved stable Preview to dev PR. Abort on semantic divergence. User's authorization does not extend to main/Production.
- After dev promotion, continue #1026 on separate task branch with safe optional flags; prioritize non-data-bearing controls before evaluating social/push/bucket-list boundaries. No unrelated changes, no data deletion.

---

# Task checkpoint — #1461 integrated v0.58.0 canonical Home-size repair
Updated: 2026-11-01 Asia/Manila

- Owner approved accepted v0.45.2 reversible diary quotes to dev; initial integrated v0.58.0 stable Preview `fix/1461-diary-quotes-dev-integrated-v0580-20261101@f3ee6bf24885cd0679ecd27de3ebcd5ab937f2b2` exactly matches locally tested source, but canonical #41232908236 build failed by 21 bytes at blocking Home gzip limit (381,021/381,000). Do not adjust build budgets.
- Scoped source fix: replace repeated remote-field deletions in the existing `syncMapping.ts` tasks/diary/friendships/messages mappers with equivalent loops over their known Appwrite field sets; delete only snake_case names and `deleted`, retaining local status, content, direction, reactions and all camelCase properties. This also handles future newly known server-owned snake_case columns. No backend migration or Function source change.
- In Vercel Sandbox, corrected local build passed (Home closure 380,818/381,000); affected mapping tests 61/61, full Vitest 2,176/2,176 across 325 files, changed-file ESLint, version/contracts and diff checks passed. Reverify exact GitHub task focused CI, stable full canonical with Node 22 and Vercel READY before approved dev promotion. No main/Production action. Scratch deployed Function changed independently but read-only schema and `revoke_diary_references` invalid-mode smoke confirm required API compatibility; do not overwrite shared active Function.

---

# Task checkpoint — #1461 accepted reversible diary quote privacy forward-port v0.58.0
Updated: 2026-11-01 Asia/Manila

- Owner accepted v0.45.2 reversible diary quote Preview and authorized merge to dev, not main/Production. Accepted stable SHA bba52bebe30bf6c40b9e9a05b08dbaf67128aa22, canonical #41229542989 succeeded, trusted Preview READY; Scratch Function 6ae6337ade2cc07d0df2 active.
- Forward-port original v0.45.1 diary quote privacy plus reversible v0.45.2 from common base 343b857fa43d26e7afc7b7f6de81ac479416bba2 onto dev@029b5cb758e1180b595c9b3f6c3822eb3a995675 v0.54.0. v0.55.0/v0.56.0/v0.57.0 reserved by other Previews; candidate v0.58.0. Preserve newer feature controls, task search, storage, categories and Day View; combine both ChatPage imports. No main/Production changes.
- Visibility revocation fences and scrubs excerpts without date/epoch loss, republishing restores authorized current content; permanent deletion invalidates. Offline/nonfriends fail closed. Additive migration 016 exists on Scratch; integrated Function source requires deployment compatibility check.
- Deliver focused tests, build/PWA/size, exact stable candidate canonical and READY Vercel, Scratch compatibility, read-only promotion preflight and nondrivergent authorized Preview-to-dev PR.

---

# Task checkpoint — #1026 Feature Controls dev reconciliation v0.54.0
Updated: 2026-11-01 Asia/Manila

- Owner accepted six operational switches on real Preview (confirmed prompt-controlled toggle changes instantly) and explicitly authorized integration into `dev`; no approval to change `main`, Production or backend.
- Source accepted: `feature/1026-feature-controls-v0460-20261031@894e5e4c6e07063841a27c0e56e9439708eb31dc`, canonical `41198033073` passed, trusted prebuilt Preview READY on Vercel. Six PostHog disable flags created as inactive in project 619969, with full-target release conditions. All remote flags remain unchanged.
- This task forward-ports the same P0 behavior from v0.46.0 onto newer `dev@606f97347ca435247e9bacc4e76a26e2c5d3c78a` v0.51.2, preserving intervening Home search, storage, Day View, and category deletion improvements. Independent Preview candidates v0.52.0 and v0.53.0 were reserved at preflight; use noncolliding v0.54.0.
- Changes: typed flag registry/hook, six read-only/offline-aware operational boundaries, PostHog stable refresh semantics, focused tests and operator documentation. Tests and CI must be run on the reconciled tree; do not reuse old v0.46.0 acceptance as evidence for v0.54.0. Existing queued uploads and media remain intact.
- Delivery: focused CI on task branch, squash to stable Preview, exact-SHA full canonical, Scratch Preview READY, read-only promotion preflight, approved dev PR. No changes to `main`, Production or PostHog remote flag states.
- Remaining after promotion: new priority P1 registry phase. Plan isolated optional capabilities (import, Timeline, Bucket List, discovery etc.) with data-preservation and background-operation boundaries before expanding the registry.

---

# Task checkpoint — #1186 P0 category deletion containment and orphan inventory, v0.51.2

- Base protected dev @ 27f78f9c51ca1aa8d37240e2eb454907dbc245d3, v0.51.1; main remains v0.50.3. Current task branch `chatgpt/1186-category-delete-containment-v0512-20261101`.
- Owner authorized first P0 containment phase after #857 lifecycle hardening, not the retirement schema or destructive backend cascade.
- All category deletion paths in current category hook/UI blocked, including `updateCategory(isDeleted:true)`; old installed PWAs may still bypass this current-client barrier. No backend or data writes.
- Owner-only, read-only inventory of tasks whose category is no longer active, across dated tasks and Backlogs, paged within Category Manager. No automatic migration/recovery.
- Focused tests target deletion guard, owner isolation, orphan filtering, and UI. Run focused CI and stable exact-SHA canonical Preview; Appwrite Scratch readiness required only for backend-dependent steps. No dev/main/Production promotion without separate approval.
- Follow-up #857: date-effective Retire/Restore, then explicitly chosen Move+Delete, then server-guarded Delete All. See #857 hardened critique. Verify old-PWA guards before claiming global deletion safety.

---

# Task checkpoint — #1477 accepted cloud inventory privacy patch v0.51.1 forward-port to dev v0.50.3
Updated: 2026-11-01 Asia/Manila

- Owner explicitly approved merging Storage Phase 2 PATCH v0.51.1 to dev and asked to continue remaining nondestructive work. Not authorized: main/Production promotion, server mutations, phase 3 destructive deletion.
- Accepted stable Preview `feature/1477-cloud-inventory-cancellation-v0511-20261101@806ddac6f73d5c63e0ce181dd6f945ec12d92ca1` passed canonical #41223168862 and Trusted Preview Delivery #41223454814; exact-SHA Vercel deployment dpl_DDruZsE1TU3iQ1NpfAnzMF5bo6h2 READY.
- Current dev `45b529a99b3bd7fe88223d4b3108f1a7e0ee96a1` v0.50.3 includes accepted one-day swipe/photo-drag improvements, in addition to Calendar scroll v0.50.2. Integrate only accepted owner-referenced cloud inventory/read-only UI/tests/docs and v0.51.1, preserving the newer Day View source and regressions. Task `chatgpt/1477-cloud-storage-dev-forward-v0511-20261101`, stable Preview `feature/1477-cloud-storage-dev-integrated-v0511-20261101`. Run task focused, stable canonical/size/browser, trusted Vercel Scratch READY, promotion PR preflight and nondivergent approved dev PR.
- Original v0.51.0 promotion PR #1515 is superseded; never merge older candidate over this privacy patch.
- Remaining Phase 2 work: read-only three-account Scratch permission denial, account switch and offline testing without live user data; no exhaustive storage/orphan claims until separately authorized server-owned index. #1478 deletion remains deferred.

---

# Task checkpoint — Day View one-day swipe momentum and photo drag, v0.50.3 reconciled dev promotion
Updated: 2026-11-01 Asia/Manila

- Owner accepted physical feel of original stable `fix/dayview-single-day-snap-photo-v0447-20261031@73692710122bd47b1ff5b0e28a6e963465701a7e`, explicitly approved merging to `dev`, and requested remaining-work audit. No `main` or Production approval. Original canonical #41216695153, exact-SHA trusted Vercel READY; integrated v0.49.1 canonical #41219378958 passed; integrated v0.50.1 canonical #41220167638 succeeded on attempt 2, including all browser shards (initial unrelated split-panel resize intermittent failure).
- Live `dev@afdca35ac2f0287b04a24f19af21a73d4a1b9838` has since gained accepted v0.50.2 Calendar scroll fix #1510, on top of Storage v0.50.0, Day View settings/sorting and search. Previous stable `fix/dayview-swipe-integrated-v0501-20261101` advanced to `86c2e2335c9abb6f2b161024ed94c0f5b3944949` through #1511 selection-mode photo test; its exact-SHA canonical #41221212354 succeeded. Do not merge stale Preview with version regression; preserve Calendar's source and new scroll test in `interaction-contract.spec.mjs`.
- Reconciliation task `chatgpt/dayview-swipe-forward-v0503-20261101` and stable `fix/dayview-swipe-integrated-v0503-20261101` derive from current dev v0.50.2. Apply only the exact accepted DayViewSheet momentum/release source blob, native photo dragging protection, Swiper FreeMode mock, current photo DOM regression (including selection-mode), and add only the single-gesture fling/partial-snap browser test to dev's existing interaction contract. The version is v0.50.3; other source/test/docs from dev are preserved.
- Verify task focused/browser, stable exact-SHA full canonical/size/registered Scratch Vercel READY, current dev SHA, promotion tree parity and configured repo preflight. Then owner-approved Preview→dev PR, checking dev checks and deployment. No backend or Production writes.
- Follow-up audit (read only): no confirmed new Day View momentum defect; device-level tests, #1008 WebKit browser lane, #858 performance diagnostics and #855 older distant-date repro remain separate unverified/ongoing work.

---

# Task checkpoint — #1388 Calendar scroll v0.50.2 integrated candidate
Updated: 2026-11-01 Asia/Manila

- Owner confirmed v0.43.13 live DevTools viewport-cap test restored Calendar scrolling, then authorized merging Calendar fix to `dev`. No main/Production approval.
- Original accepted Preview `fix/calendar-long-grid-scroll-20261027@080959b4c7ff7c38fa993893523ed1f828c1eeda` passed canonical Quality Gate #41186816066 attempt 3 and exact-SHA Vercel READY. It is version 0.43.13. Direct promotion would regress version from latest dev 0.50.0.
- Integrated task `chatgpt/1388-calendar-scroll-forward-v0502-20261101` and stable Preview `fix/1388-calendar-scroll-integrated-v0502-20261101` begin from exact dev `f01a43479baa476d4ed1c8074a430a1065af66f7`. Apply only the accepted Calendar-related frontend changes and browser regressions, leaving all other dev features and docs intact. New version **0.50.2** (0.50.1 reserved by active dayview Preview).
- Required: task focused+browser CI, squash PR into stable integration Preview, full canonical Quality Gate, exact SHA Vercel READY, GitHub/Vercel read-only promotion preflight, then approved stable Preview → dev PR (only if dev HEAD still matches safe base; reconcile drift otherwise). No main/Production promotion, backend data migration, CI bypass or user-account changes.
- Outstanding manual: hosted v0.50.2 Preview parity with owner-confirmed DevTools fix and phone view may still need separate verification; user approved dev merge after successful live-page clamp and accepted previous Preview.

---

# Task checkpoint — #1476 approved v0.50.0 Storage promotion, docs-only dev drift
Updated: 2026-10-31 Asia/Manila

- Owner accepted Phase 1 and authorized dev merge, then Phase 2 #1477. No main/Production authorization.
- Accepted v0.50.0 Storage Preview `feature/1476-storage-integrated-v0500-20261031@971eeb2d92ceedfa733a72691368f2f8dcc76f77` passed full Quality Gate #41218156275, Trusted Preview Delivery and exact-SHA Scratch Vercel READY. Owner accepted functionality originally at v0.48.0; version reallocated after dev reached v0.49.0.
- Promotion PR #1502 passed preflight but dev advanced to `7ac1a99427750a95c1d9c3da0593f72c650214e4` (documentation-only workflow #1501). GitHub refused merge with SESSION_STATE conflict. New task `chatgpt/1476-storage-doc-reconcile-v0500-20261031` forward-ports the **same accepted v0.50.0 app source and version**, preserving latest dev AGENTS/workflow/Scratch instructions and this checkpoint. Stable `feature/1476-storage-final-v0500-20261031` must pass focused/canonical/Preview before dev promotion.
- Phase 2 #1477 to follow successful dev promotion; owner-scoped read-only media metadata only, never cloud deletion or fabricated account quotas.

---

# Task checkpoint — Vercel Sandbox operational path for #1461
Updated: 2026-10-31 Asia/Manila

- User requested a permanent rule: try Vercel Sandbox before requesting manual terminal execution. Existing official Vercel project Sandbox history from October 22/31 and a newly created disposable Sandbox confirm shell access and exact-SHA Git checkout are available in this connected Chat.
- New Sandbox `mosaic-1461-scratch-ops-probe-20261031` executed Git/Bash/Node at `/vercel/mosaic-life-tracker`; checkout `faae41b5bf93e72f4c9b6f8ec75bef720966c4b8` clean; Frankfurt Scratch endpoint reachable without authentication (HTTP 401).
- No `APPWRITE_API_KEY` inherited in Sandbox. Shell works; Scratch migration 016, Function deployment, historical scrub and two-account privacy acceptance remain blocked by lack of an authorized Scratch-scoped administrative credential. No Scratch/Production mutation.
- Documented rule in `AGENTS.md`, `AI_WORKFLOW.md` and `SCRATCH_PREVIEW_WORKFLOW.md`; version impact NONE. Do not promote #1461 Preview feature to dev or Production as part of docs-only workflow update.

---

# Task checkpoint — #951 Day View v0.49.0 integrated promotion candidate
Updated: 2026-10-31 Asia/Manila

- Owner explicitly approved merging the accepted Day View settings + Timeline Completed-last Preview to `dev`; `main`/Production remain unapproved. Original accepted Preview `feature/951-dayview-settings-sort-v0490-20261031@9f3080cbb40c475c49ef6c080f448f14f4d12d64` has canonical #41212463460 SUCCESS and matching Scratch Vercel READY.
- Original Preview diverged because `dev` advanced to `215bbe86b39ea779120d2882a6086e0756f55d5c` v0.47.1 with #1473 Uncompleted Tasks search and earlier #1466 Home search pagination. GitHub comparison verifies these additions touch only Uncompleted Tasks source/tests, three version files and this checkpoint, not any Day View/Settings implementation files. Preserve both completed features exactly.
- Forward port original accepted source/test blobs unchanged to current `dev`; preserve its whole checkpoint below, carry accepted v0.49.0 in the three version files without bump, and create `chatgpt/951-dayview-settings-forward-v0490-20261031` → `feature/951-dayview-settings-integrated-v0490-20261031`. Source includes the direct Day View gear/route, restored selected date, related Tasks & Calendar navigation, Timeline Completed last + Newest/Oldest and prior Completed first/mobile header regressions.
- Required steps: task focused CI; squash into integrated stable Preview; exact-SHA canonical checks and Vercel Scratch READY; verify dev has not moved again; then owner-authorized stable Preview → dev PR merge preserving identical tree. Do not merge stale original Preview or skip gates; device/manual checks remain unverified.

---

# Task checkpoint — #1473 Uncompleted Task search v0.47.1 integrated Preview candidate
Updated: 2026-10-31 Asia/Manila

- Owner accepted user-visible v0.47.0 Uncompleted Task search Preview from issue #1473 and requested removal of the white separator directly beneath the expanded search input followed by promotion to `dev` (explicit promotion approval only for this feature; no `main` or Production approval).
- New `dev@343b857fa43d26e7afc7b7f6de81ac479416bba2` is v0.45.0 including #1466 Home task search pagination. To preserve that completed work, forward-port the accepted #1473 v0.47.0 source and existing focused regressions onto current dev and remove **only** the expanded Uncompleted Search container `border-b border-border` classes. The input's own border, existing header divider, groups, owner privacy, task operations and app behavior remain unchanged.
- Revision uses v0.47.1 PATCH after first successfully delivered v0.47.0 Preview. Task branch `chatgpt/1473-search-divider-forward-v0471-20261031`; new stable Preview `feature/1473-uncompleted-search-v0471-20261031`. The source page, helper and both existing test files come from accepted #1473 Preview; version and all other files come from latest dev. No backend/schema/sync change.
- Run focused checks, squash task PR into new stable Preview, full canonical build/size/browser CI and trusted Vercel Scratch READY. Verify branch/version drift and exact source tree before explicit accepted Preview → `dev` merge; if dev advanced again, reconcile into a fresh integrated Preview and reverify before merge. Required real device/login acceptance remains unverified until performed; no Production modification.

---

# Task checkpoint — #1466 Home task search incremental results v0.45.0
Updated: 2026-10-31 Asia/Manila

- Authorized implementation of Home Search `Load more tasks` in 50-result increments. Source baseline: `dev@4aec8d63ef460cbc56a8f895f0f609a2152ea459` (v0.44.4). Task branch: `chatgpt/home-task-search-load-more-v0450-20261031`; target stable Preview: `feature/1466-home-search-load-more-v0450-20261031`.
- Scope: change only the lazy Home Search results window; preserve local RxDB owner-only input, ranked search, filters and Day View/Backlogs navigation. Initial 50 matches; Load more appends 50; reset window when query/filters change or search clears/closes. Preserve scroll offset on append. No Appwrite, migration, dependency or Production change.
- Files: `src/components/home/HomeTaskSearchExpanded.tsx`, existing DOM/unit search regressions, three version files, this checkpoint and §2 search contract. Candidate Preview version `0.45.0`.
- Delivery: commit one coherent task tree with `[verify:focused]`, inspect focused CI; only after green squash via PR to stable Preview, then verify exact-SHA canonical CI, size/PWA and official Scratch Vercel READY. Manual phone scroll/focus acceptance remains separate. No approval to promote to `dev` or `main` or modify Production. Issue #1466 remains open until delivery acceptance.

---

# Task checkpoint — #1443 Preferences replication integrated v0.44.4
Updated: 2026-10-31 Asia/Manila

- User expressly authorized merging the accepted preferences-sync repair to `dev`; current integration baseline is `dev@43d40603fa5e59c0d3a1bd1363ab69a3aefff6ff` v0.44.3 with both #1386 page swipe and cold-start work. Old v0.44.1 isolated Preview cannot promote over newer versions.
- First v0.44.4 candidate from v0.44.2 at `fix/1443-preferences-sync-v0444-20261031@fe22206390770dd9a791e84a5cb47ecd831cc0c3` passed full canonical on retry (browser drag test was intermittently red), but publisher found no attempt-2-matching artifact, and concurrent v0.44.3 promotion advanced dev. That candidate was not delivered/promoted.
- Current forward-port task `chatgpt/1443-sync-forward-0443-v0444-20261031` and stable Preview `fix/1443-preferences-sync-v0444-integrated-20261031` apply the **same unchanged five preference source/test blobs** on latest dev v0.44.3. Assign v0.44.4 as the next available patch without modifying swipe performance behavior. Run focused verification, squash into stable Preview, full canonical CI and trusted Vercel Scratch READY. Then merge only this accepted source into `dev` per owner approval, checking dev head drift again. No main or Production mutation.
- Core fix: migrate legacy oversized-ID preference values to valid owner/key IDs before local cleanup and skip only impossible-remote oversized physical-deletion RxDB queue entries. Valid-ID deletion remains tombstone-only; preserve user isolation. Real production-device sync acceptance remains pending; leave #1443 open.

---

# Task checkpoint — #1386 cold first-swipe preparation (Phase 1+2)
Updated: 2026-10-31 Asia/Manila

- The user-approved v0.44.2 prepared-page forward-port was merged to protected `dev@a9f1650f9b262705413b64e3d5b2288b53620e83` via PR #1449 after stable Preview #1448, exact-SHA canonical, Vercel READY and unchanged-tree merge. Production/main unchanged.
- Next candidate v0.44.3 branches from that dev merge. It shares the returning-Home initial preload with the route's prepared component cache instead of a disconnected module import, and schedules neighbor code after Home local data readiness and next paint. Non-Home neighbor preloads advance to the next post-paint frame; messages keep their earlier immediate warmup.
- The new one-shot startup readiness listener is cancellation-safe and side-effect free for synced data. Optional Home neighbor module-readiness marks are included in the synthetic mobile audit; **no physical-device or authenticated-PWA timing is claimed**. Full installed PWA swipe/content settle audit still needed.
- Tests exercise Home first render, mark subscriptions (early, late, canceled, failure isolation), and existing route/gesture contracts. No data/provider/backend/Production changes. New v0.44.3 user-testable refinement requires task focused CI then fresh stable Preview canonical/size/Vercel; no automatic dev/main promotion for this iteration.
- Outstanding cross-workstream: #1443 preferences sync Preview reserves v0.44.1, and may need version reconciliation after v0.44.2 dev promotion.

---

# Task checkpoint — #1386 swipe first-frame / Settings compatibility
Updated: 2026-10-31 Asia/Manila

- User authorized promotion of previously accepted v0.43.9 swipe Preview to dev, followed by cold-start work. At request time dev had already received unrelated v0.44.0 Settings/Me reorganization (dev `efeec22df14b4cb9d8dc1ffa3d5852e7af4a1775`). The old v0.43.9 tree diverged, was lower-versioned and omitted new Settings routes; exact older-tree promotion is unsafe.
- This v0.44.2 forward-port starts from current dev, retains all v0.44.0 Settings routes, and carries the previously accepted prepared route module caching to actual routes and swipe previews. Reuses each Settings/Preferences page with its original pathname-aware preview props. Adds deferred Settings child module warmup and focused regression.
- v0.44.1 is separately reserved by #1443 preferences sync Preview. Do not alter or promote that work in this task.
- New task `chatgpt/1386-swipe-forward-port-v0442-20261031`, target stable `perf/1386-swipe-forward-port-v0442-20261031`; run focused CI, squash task into stable Preview, verify full canonical and exact Vercel READY, and only then request approved dev PR merge. No main or Production promotion.
- Next cold-start refinement (Phase 1+2) should branch from the promoted dev source after verifying branch head; measure cold first-swipe vs warm and consolidate duplicate Home preload module identity, without blanket eager page mounts or data side effects. Maintain navigation/back/gesture/reduced motion and account isolation.

---

# Session checkpoint
Updated: 2026-10-27 Asia/Manila
Current task: #1384 Settings and Me reorganization, full Preview acceptance repair; task branch `chatgpt/1384-preview-preload-registry-fix-20261027`, based on stable Preview `feature/1384-settings-information-architecture-preview-20261027@4a8eb1dc7b1143cf29b7cca18a1ea1c447507859`.

## Objective, scope and constraints
Owner approved Settings categories, search, Me tap-navigation with **no visual change to Me**, and legacy placeholder cleanup. Frontend only, v0.44.0 Preview. No `dev`/`main`/Production promotion or provider/backend/data edits approved.

## Accepted task checkpoint
- Task PR #1392 squash merged into protected stable Preview SHA `4a8eb1dc7b1143cf29b7cca18a1ea1c447507859`. Final task focused Quality Gate #40506056120 passed. Earlier #40504980671 and #40505469873 passed. Current code includes Account, Data & Sync, About Mosaic, five categorized Preferences pages, local index for individual preferences and Notifications, source-compatible Settings route-preview destination rendering and unchanged Me classes.
- Stable canonical Quality Gate #40506296566 failed the `build` job at TypeScript `TS2740` because `src/components/layout/primaryRoutePreload.ts` mapped old preview-supported routes only and lacked all eight new supported Settings/Preferences child paths. Stable DOM and dependency-audit jobs passed; browser tests in progress at diagnosis. No successful build/deployment should be inferred from source merge.

## Repair and next action
- Add exactly the eight route preload entries to existing module importers, preserving lazy bounded warm-loading and exhaustive `PreloadPath` type contract. No other runtime design changes.
- Run focused verification on coherent repair task commit; squash into existing stable Preview only after green; require new stable exact-SHA full canonical CI, production size budget, official Scratch Vercel READY, and relevant browser/device checks. Keep issue #1384 open and request separate approval before any promotion to `dev` or `main`.
- Do not weaken typing, size ceilings, security, sync, or release gates.
