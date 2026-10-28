## #975 OCI failure diagnosis via signed Cloudflare dispatch (2026-10-28)

Cloudflare five-minute cron deployed and user reported GH dispatch gates true and Worker secret DISPATCH_ENABLED=true. GitHub runs 40635476174, 40635958804, 40636436658 passed HMAC and OCI setup but failed at LaunchInstance with combined safe error. No successful VM claim verified. Isolated task from stable OCI Preview 03e5c8dc6a0109d72604ca65582f692ea9978927 separates known OCI API errors into safe categories without changing any provisioning parameters, quotas, IAM or retry behavior. Run focused then stable Preview canonical and trusted Preview; repin scheduler only after acceptance. Next scheduled run should identify category. Keep GitHub cron until cutover verified; do not alter app dev/main or Production. Track #975.

---

# Session checkpoint

## #975 Cloudflare external cron reliability — source-only staging, 2026-10-28

Owner requested a more reliable five-minute OCI watcher after GitHub recorded only 10 scheduled executions on Oct 27. Isolated branch `chatgpt/975-cloudflare-dispatch-20261028` begins at accepted controller `5673549e34fc68430f96764c13ce994fb91441dd`. Add strict opt-in signed workflow_dispatch provenance so manual dispatch stays observe-only and existing fixed-size/single-instance/free-tier/quota/IAM controls remain unchanged. Pair with standalone scheduler Worker code, confirm both CI paths, then pin only an accepted source SHA; no Cloudflare Worker, OCI resource or Production deployment is activated by this branch. Cloudflare connection/deployment and private secret setup remain separate operator actions; no bypass or global toggles before verified dry run.

---


## #975 post-activation scheduled failure / regionalized OCID fix — 2026-10-28

Public standalone scheduler `carlers/mosaic-oci-a1-scheduler@20aa54f19f924845a72738088f42c328009bcfb1` is pinned to accepted controller `38aa7fbae05caef832b7a40e18921d8a42e11ab7`; six post-activation scheduled runs failed on the `Check capacity and optionally claim ONE A1 instance` step with sanitized `Dedicated subnet OCID required` error. Real Singapore subnet/image OCIDs have region tokens with hyphens, which strict `[a-z0-9.]+` mistakenly rejects; no OCI launch was attempted by these failed runs. Isolated task `chatgpt/975-region-ocid-validator-20261028` widens the region-safe character class, adds negative and positive validation tests, and preserves all launch/identity/size controls. Follow focused CI then squash into `refactor/975-github-a1-autoclaim-20261019` for full canonical/Preview, then repin standalone scheduler after acceptance. User previously explicitly approved activating this exact guarded A1 automation; repair does not authorize other Oracle or Mosaic Production changes. Cron nominally five minutes on public repo (12 slots/h), but GitHub delayed/missed many slots. Keep #975 and separate ChatGPT monitor open; only actual JSON `instance_created` proves claim. Next: verify source/test diff and focused CI, deliver and inspect real logs.

---

## #975 tenancy-qualified Singapore AD correction — 2026-10-27

Task branch `chatgpt/975-tenant-prefixed-ad-20261027` starts from stable OCI Preview `refactor/975-github-a1-autoclaim-20261019@7783b6b438d2b964f2e15db49cec349ba1463547`; it corrects the candidate's bare `AP-SINGAPORE-1-AD-1` LaunchInstance argument to the exact tenant-prefixed name returned by OCI's identity SDK. Inventory and verified domain are still fail-closed; all prior strict resource, identity, confirmation, single-attempt, privacy, manual observe-only and error-classification safeguards remain. Include new domain regressions and focused/full canonical and trusted Preview checks before activating. Owner verified PAYG and 0 Singapore A1/volume/backup/container usage, plus effective 2 A1 OCPU/12 GiB/50 GiB limits and bot group membership through read-only SDK Cloud Shell. Live scheduler main remains pinned to the OLD controller and must not be repinned without separate go-live authorization; no Oracle infrastructure or Production changes. Issue #975 open.

---

## #975 isolated OCI A1 controller correction — October 27, 2026

Task branch `chatgpt/975-a1-direct-launch-safety-20261027` starts at accepted pinned OCI controller commit `6fe15940fae40adc7d4728a6ea26ea6c289314c9`. This is **not** the live standalone scheduler, which remains pinned to the old source, or the current application `dev`/Production. Scope: replace advisory positive-count precondition with one direct LaunchInstance request, but only after strict scheduled trusted-main context, literal owner confirmations, lifecycle-aware full A1 inventory, and image/subnet/SSH validation. Preserve exact A1 sizing, private IP, one no-retry attempt, fail-closed ambiguous failures, and secret-safe logs. Manual dispatch always remains read-only. Task requires focused CI and separate OCI quota/IAM/billing review before an owner-approved update to the public scheduler's immutable controller SHA. No account/billing/OCI data or app release changes. Issue #975 stays open.

---

Updated: 2026-10-19 UTC
Current task: #975 private OCI A1 scheduler launch-inventory fail-closed repair.

## Verified scope and state
- Isolated stable Preview `refactor/975-github-a1-autoclaim-20261019@7ce292b819c85bc87380c24a1a7b54c96ed31cab`, previously passed full canonical acceptance and trusted Preview. Protected `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` and `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` remain untouched.
- Private scheduler exists `carlers/mosaic-oci-a1-scheduler@db35ca0d01c4ab1f86bd23f782482e6b8397719b`. First manual capacity run #39207768310 succeeded (Oracle Singapore A1 OUT_OF_HOST_CAPACITY). Three manual read-only launch preflights failed. Latest #39214660878 passed explicit SDK inventory and image/compatibility calls but failed `network subnet get` (root-compartment subnet authorization).
- Owner reports creating dedicated OCI compartment quotas, bot identity+API key, limited IAM policies, budget alerts, eight private scheduler secrets, and setting observe-only 30-minute watch variable. These settings cannot be independently read via connected tools. No schedule-event run verified. No OCI VM created or launch attempt authorized.

## Source-only fix (this task)
- `scripts/oci-a1-autoclaim.mjs`: replace CLI `instance list --all` with OCI SDK explicit paginated instance-shape inventory. Reject absent/malformed/missing shape metadata, no fallback-to-empty. All other fixed-shape, no-public-IP, one-attempt, schedule-only and billing/quota launch gates preserved.
- `tests/unit/ociA1Autoclaim.test.ts`: adapt synthetic subprocess mocks and add regression cases for empty stdout, invalid JSON shape metadata and denied SDK request; never invoke launch under inventory uncertainty.
- `docs/OCI_GITHUB_A1_AUTOMATION.md`: record diagnostic and migration restrictions.
- This is internal tooling only: no app version bump, frontend, Appwrite, Supabase or Production changes.

## Next and gates
- Run task focused CI and then squash to isolated stable Preview; verify canonical acceptance and trusted Preview before updating the private scheduler's immutable controller SHA.
- Owner needs a corrected *read-only* `SUBNET_READ` permission for `GetSubnet` scoped to the root tenancy compartment. Do not grant tenancy-wide network management.
- Have owner rerun the manual read-only prerequisite audit after IAM propagation. Prove network and image checks and observe at least one scheduled watch run; diagnose missing scheduled events if needed.
- **No launch authorization**: Leave `MOSAIC_OCI_AUTOLAUNCH`, quota and Always Free confirmation variables unset. Do not claim source unit tests prove launch IAM, OCI costs or enforced quotas. Keep #975 open.
