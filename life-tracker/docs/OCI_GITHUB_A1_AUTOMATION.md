# GitHub-hosted A1 capacity claim — DORMANT until approved (#975)

## Singapore tenancy-qualified availability domain correction — 2026-10-27

During the final owner PAYG and hard quota audit, the actual availability-domain name was observed as a tenancy-qualified string ending in `:AP-SINGAPORE-1-AD-1`. Oracle's LaunchInstance documentation expects this fully qualified name, while the first direct-attempt candidate passed the region-only `AP-SINGAPORE-1-AD-1` identifier from advisory capacity reports. The latter risks an OCI `InvalidParameter` refusal.

The follow-up isolated candidate `chatgpt/975-tenant-prefixed-ad-20261027` uses the OCI Python SDK to retrieve the exact uniquely matching AD via `ListAvailabilityDomains` under the authenticated tenancy, alongside existing paginated instance inventory. It fails closed unless an exact valid tenant-prefixed Singapore AD is present; the same value is then passed unchanged to `LaunchInstance`. The advisory capacity identifier remains distinct. The workflow never logs the tenant prefix or any OCIDs.

Owner's **read-only** Cloud Shell SDK audit independently verified Singapore-wide 0 live A1 VMs, 0 GiB boot/block storage and 0 backups, 0 container instances, effective quotas 2 A1 OCPU / 12 GiB RAM / 50 GiB volume, and bot membership in its scoped automation IAM group. Account type is PAYG; current instance size is within Always Free resource allowances provided no other usage consumes eligibility. None of this constitutes a test launch. The live public scheduler continues pinning the previous immutable controller; only an explicit go-live approval after successful focused/full CI and trusted Preview may repin it. GitHub variables `AUTOLAUNCH`/`WATCH_ENABLED` must be disabled by owner after confirming a created VM and actual billing classification.

---

## Isolated direct-launch correction — October 27, 2026 (#975)

A proposed controller change on `chatgpt/975-a1-direct-launch-safety-20261027` remedies the old capacity-report prefilter. The standalone public scheduler still pins the *unchanged* accepted controller `6fe15940fae40adc7d4728a6ea26ea6c289314c9`; this task branch alone does NOT affect live claiming.

The new candidate keeps manual dispatch strictly observe-only, preserves explicit launch opt-in / Always Free and quota confirmation variables, validates dedicated-compartment A1 inventory with lifecycle states and blocks any nonterminated A1, validates Ubuntu 24.04 A1 compatibility and subnet, then attempts exactly one no-retry fixed A1 (2 OCPU, 12 GiB, 50 GiB boot) launch with no public IP. Unlike before, advisory capacity reports are not a launch precondition. A fully `TERMINATED` historical row no longer blocks claiming. Known OCI out-of-capacity and throttle errors are reported separately; IAM, quota and unknown errors fail closed. `instance_created` is emitted only after OCI returns a nonempty instance ID and the exact shape. Public logs never print the instance ID or raw error text. No automatic Appwrite setup occurs.

**Release hold:** Do not re-pin the public scheduler or enable this newly expanded launch behavior until focused/canonical CI, independent OCI quota/billing/IAM evidence, and a fresh owner approval to activate the direct-attempt source. OCI budget alerts do not impose hard spending caps. On a successful claim, independently verify the VM and Always Free cost classification in the Singapore Console; then set both repository variables `MOSAIC_OCI_AUTOLAUNCH=false` and `MOSAIC_OCI_WATCH_ENABLED=false`. Existing hourly ChatGPT monitoring remains independent. Historic text below describes the old, pre-public installation process.

---

**Purpose:** User cannot keep Fedora powered on, wants GitHub to check
Oracle Singapore A1 capacity on a configurable schedule and, once a slot is likely available,
claim one *specific* Always Free-sized ARM VM automatically.

**Current status: NOT ACTIVE.** The existing Mosaic-repository workflow is
prepared in an isolated Preview branch only. GitHub runs scheduled workflows
from the *default branch of the repository containing the workflow*. Promotion
of Mosaic's workflow to Production `main` is **not** authorized. The
recommended alternative below uses a separate private GitHub repository's
default `main` and therefore does not affect Mosaic's Production branch.

## Recommended: separate private scheduler (no Mosaic main promotion)

This source tree contains the reviewed **template** at
`../ops/oci-a1-scheduler/.github/workflows/oci-a1-autoclaim.yml`.
The template is not live merely because it exists inside Mosaic's tree;
it must be installed in its own repository. The scheduled job downloads a
**specific approved Mosaic commit SHA**, verifies that exact source revision,
and invokes the controller. It refuses non-private/other repository contexts,
non-default refs and any manual event for launch. Its signing credentials
stay only in the private scheduler's encrypted GitHub Actions secrets.

### Polling interval, trade-offs and GitHub Actions costs

- **Normal (default):** `17,47 * * * *` (30-minute interval,
  UTC minute 17 and 47). The private scheduler attempts 1,440 runs in
  30 days, compared with 720 for hourly. Actual runs can be delayed or
  dropped, so this is not an exact polling SLA.
- **Fast (opt-in):** Set the **repository variable**
  `MOSAIC_OCI_FAST_POLL=true` to enable the ten extra scheduled
  events per hour; together with the two baseline events, polls are
  requested at UTC minutes 2, 7, 12, ... 57 (every 5 minutes).
  Disable it by deleting the variable or setting it to `false`.
  The extra events stay present in the GitHub schedule but their jobs
  are **skipped** when fast polling is off.
- **GitHub Actions cost:** GitHub Free private repositories have 2,000
  included standard-runner minutes **shared by the account** each month.
  Private-repo jobs bill at least 1 minute per run; 30-minute polling
  is *at least* 1,440 minutes per 30 days, while 5-minute polling is
  *at least* 8,640 minutes per 30 days. Actual runs and accrued minutes
  depend on GitHub scheduling, startup delays and execution duration.
  Other private-repository CI consumes the same account quota. Even
  30-minute polling might exceed the allowance; do **not** assume $0.
  Explicitly check GitHub Billing → Budgets and alerts, enable
  **Stop usage when budget limit is reached** where available, and
  inspect the real execution minutes after the observe-only trial.
  With a payment method, overages may incur charges; without one,
  GitHub may stop running workflows on exhaustion of free minutes.
- **Scheduling limitation:** GitHub's shortest supported Actions cron
  interval is 5 minutes; starts may be delayed or skipped under load.
  More frequent capacity reports cannot guarantee allocation and should
  not be used to imply a free or guaranteed VM.

Official documentation: [schedule limits](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax-for-github-actions#onschedule),
[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions),
[rounded billable minutes](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-job-execution-time).

### Duplicate-instance inventory is fail-closed

OCI CLI 3.95.0 was observed returning exit status 0 but an empty stdout for
`compute instance list --all` on the private scheduler bot. A blank CLI
response must **never** be interpreted as an empty compartment. The launch
controller instead uses the OCI Python SDK (already installed with the
scheduler OCI CLI) and enumerates all pages, returning only instance shapes.
A failed, malformed or incomplete SDK result prevents launch. The private
scheduler must be updated to pin the accepted controller SHA **only after**
focused and canonical Preview verification. The bot must also have access to
the selected root-compartment subnet; `GetSubnet` requires `SUBNET_READ`.
The additional read-only preflight and scheduled workflow behavior need
separate live evidence. No extra authorization to launch is implied.

### One-time setup (on your own accounts; no credentials in chat)

1. On GitHub, create a **private** repository named
   `carlers/mosaic-oci-a1-scheduler`, default branch `main`. Do not
   select a different owner/name without a reviewed controller change.
   This does not touch Mosaic's protected `main`.
2. After this Mosaic source-only change passes focused and full CI/trusted
   Preview, copy the above template into the private repository as
   `.github/workflows/oci-a1-autoclaim.yml` on the new repository's
   `main`. Replace exactly `REPLACE_WITH_ACCEPTED_STABLE_SHA` in
   `MOSAIC_CONTROLLER_SHA` with the **40-character stable Preview commit SHA**
   from the accepted handoff. Do not pin a task branch, a tag or a floating
   ref. The checkout plus `git rev-parse HEAD` check fail closed on mismatch.
   The workflow has no PR trigger; the first manual dispatch is *observe only*.
3. In the Oracle Singapore home region verify eligibility, existing A1 usage,
   storage usage, alerts and no-charge classification. Create a **dedicated
   compartment** named `MosaicA1` (or a separately chosen controlled name),
   with approved quota statements no higher than these **exact cap candidates**:
   ```text
   set compute-core quota standard-a1-core-count to 2 in compartment MosaicA1
   set compute-memory quota standard-a1-memory-count to 12 in compartment MosaicA1
   set block-storage quota total-storage-gb to 50 in compartment MosaicA1
   ```
   Verify that OCI accepted and **enforces** each quota, and that other
   resources in the compartment do not consume the available allowance.
   The block quota covers **boot and block** volumes; avoid any extra paid
   capacity. OCI quotas constrain quantities, not your tenancy's pricing.
   Do not equate 2 OCPU/12 GiB/50 GiB with guaranteed free billing.
4. Create a dedicated OCI automation **IAM user/group and new API signing
   key**, not the personal CLI/administrator key. Grant only the required
   compartment-scoped instance launch/inventory and VNIC/boot volume rights,
   plus read-only tenancy availability-domain/capacity and image lookups.
   Network `use` policy should target the existing VCN/subnet compartment.
   Validate the policy using Oracle's current IAM policy evaluator/common
   policies before providing credentials. Create no unbounded tenancy-wide
   `manage all-resources` grant.
5. Choose an OCI ARM-compatible **Ubuntu 24.04** platform image OCID,
   the exact allowed subnet OCID and a valid **public** SSH key. Never
   upload an SSH private key. The claimed machine will **not** have a public
   IPv4 address, Appwrite installation, open services or user data.
6. In the **private scheduler** repository → Settings → Secrets and variables
   → Actions → Repository secrets, install these eight encrypted secrets
   under their exact names:
   ```text
   MOSAIC_OCI_TENANCY_OCID
   MOSAIC_OCI_USER_OCID
   MOSAIC_OCI_FINGERPRINT
   MOSAIC_OCI_API_KEY_PEM
   MOSAIC_OCI_COMPARTMENT_OCID
   MOSAIC_OCI_SUBNET_OCID
   MOSAIC_OCI_IMAGE_OCID
   MOSAIC_OCI_SSH_PUBLIC_KEY
   ```
   Paste the **new dedicated automation** API private PEM only into the
   encrypted `MOSAIC_OCI_API_KEY_PEM` secret. Use the *public* SSH key
   text for `MOSAIC_OCI_SSH_PUBLIC_KEY`. Neither belongs in a commit or chat.
7. Keep the private repository variable `MOSAIC_OCI_AUTOLAUNCH` **unset**
   (default `false`). Leave `MOSAIC_OCI_FREE_TIER_CONFIRMED` and
   `MOSAIC_OCI_QUOTA_CONFIRMED` unset (default `NO`). Leave optional
   `MOSAIC_OCI_FAST_POLL` unset (default normal 30-minute cadence).
   In Actions select
   the new workflow → **Run workflow** and inspect its advisory result
   and logs. It may report no capacity or OCI IAM failures without launching.
   If workflow installation/pinning/secrets fail, repair those first.
8. Only with fresh, explicit owner authorization to accept the residual
   launch/billing risk and separately confirmed hard quotas, configure
   repository **variables**:
   ```text
   MOSAIC_OCI_AUTOLAUNCH=true
   MOSAIC_OCI_FREE_TIER_CONFIRMED=CONFIRMED
   MOSAIC_OCI_QUOTA_CONFIRMED=CONFIRMED
   ```
   These are ordinary GitHub Variables, **not** Secrets. A manual dispatch
   can never launch; *only a scheduled run* may attempt a single
   eligible VM. On successful creation, turn `MOSAIC_OCI_AUTOLAUNCH` off
   or disable the workflow and inspect OCI Console/billing. Do not rely
   on this workflow to stop or terminate a VM.

The standalone private repository may consume the account's GitHub Actions
minutes; scheduled workflow starts can be delayed or skipped. A positive
capacity report is advisory; a denied one-shot launch is not retried. A
separate repository is **not** a separate billing account and does not
change any OCI tenancy service limits. No automatic notification outside
GitHub Actions is implemented. This plan is an *operator template*, not
evidence that the repository, secrets, hard quotas or VM already exist.

Relevant official references:
- [GitHub schedule default-branch rule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [Oracle compute core and memory quota names](https://docs.oracle.com/en-us/iaas/Content/Quotas/Concepts/resourcequotas_topic-Compute_Quotas.htm)
- [Oracle boot/block storage quota](https://docs.oracle.com/en-us/iaas/Content/Quotas/Concepts/resourcequotas_topic-Block_Volume_Quotas.htm)
- [Oracle launch IAM policies](https://docs.oracle.com/en-us/iaas/Content/Identity/Concepts/commonpolicies.htm)

## Two modes and their protections

Original Mosaic-repository workflow: `../../.github/workflows/oci-a1-autoclaim.yml`.
Standalone private-repository template: `../ops/oci-a1-scheduler/.github/workflows/oci-a1-autoclaim.yml`.
Controller: `../scripts/oci-a1-autoclaim.mjs`.

- **Observe (default):** The standalone private scheduler checks every
  30 minutes (5 minutes if fast polling is explicitly enabled). The
  original, dormant Mosaic-repository workflow remains hourly. Both run
  the same advisory report from OCI for ap-singapore-1, AD-1, exact A1 2 OCPU /
  12 GiB. Does not launch VM. An AVAILABLE report still can race
  against another requester.
- **Auto-claim (opt-in only):** Requires the repository variable
  MOSAIC_OCI_AUTOLAUNCH set to literal true, plus independent variables
  MOSAIC_OCI_FREE_TIER_CONFIRMED=CONFIRMED and
  MOSAIC_OCI_QUOTA_CONFIRMED=CONFIRMED. Code independently verifies
  the scheduled workflow runs on the exact default-branch ref of
  `carlers/mosaic-life-tracker` or the dedicated
  `carlers/mosaic-oci-a1-scheduler`, positive available-count, no prior A1
  instance (including stopped and listed terminated) in the dedicated
  compartment, Ubuntu 24.04 image AVAILABLE and compatible with A1,
  and the chosen subnet AVAILABLE. Then it makes **at most one**
  no-retry Compute instance launch call per scheduled run.
- **Fixed launch:** VM.Standard.A1.Flex, exactly 2 OCPUs / 12 GiB RAM,
  50 GiB boot disk, provided supported Ubuntu 24.04 image, provided
  subnet, provided *public* SSH key. Explicitly **no public IPv4**,
  no fault-domain pin, no cloud-init, no Appwrite installation, no
  private API keys on the VM, no extra block volumes.
- **Duplicate protection:** GitHub concurrency serializes job runs;
  existing A1 instance inventory in its dedicated compartment
  prevents another while the instance is listed, and Oracle's
  compartment quotas must hard-cap 2 OCPUs / 12 GiB. These controls
  do **not** guarantee at-most-one-ever if an instance is deleted,
  credentials or compartment quotas change, or another actor launches
  concurrently. Disable the workflow after successful creation.
- **Failures:** unknown capacity, API error, invalid Ubuntu/shape/subnet
  metadata, inadequate permissions or missing confirmation **block**
  launch. No fallback to paid shapes, bigger disk or other regions.
  Failures never print raw OCI CLI error text, secret values or OCIDs.
  No notifications outside GitHub Actions are currently implemented.

## Required account setup before activation (owner only)

1. Verify Oracle Singapore is the **home region**, account is eligible
   for the 2 OCPU/12 GiB **Always Free** A1 allocation, no competing
   A1 VM consumes that quota, and aggregate 50 GiB boot volume fits
   within the free combined 200 GiB block/boot storage allotment.
   Check Oracle **Limits, Quotas and Usage** and Billing; create a
   zero-budget/cost alert if available. **Neither the capacity report
   nor this code can guarantee zero charges**.
2. Create a dedicated OCI compartment for Mosaic A1 claiming,
   and **hard compartment quotas** restricting the allowed A1
   resource totals. Create a **dedicated automation IAM user/group**
   with only the required read capacity/image/subnet and narrowly
   scoped Compute launch plus necessary boot-volume and VNIC
   permissions. Validate policies against Oracle's current IAM
   documentation. Do not use the account administrator signing key.
   Any automation credential capable of launching VMs is sensitive.
3. Select an Oracle-published ARM64 Ubuntu 24.04 image compatible with
   VM.Standard.A1.Flex, a subnet you control (can be the existing VCN
   after IAM read authorization), and an SSH **public** key for the
   instance's future authorized_keys. Do not put SSH private keys in
   GitHub or this repository.
4. In GitHub repository Settings → Secrets and variables → Actions,
   configure encrypted **secrets**:
   MOSAIC_OCI_TENANCY_OCID, MOSAIC_OCI_USER_OCID,
   MOSAIC_OCI_FINGERPRINT, MOSAIC_OCI_API_KEY_PEM (the *dedicated
   automation IAM user's* private API signing key),
   MOSAIC_OCI_COMPARTMENT_OCID, MOSAIC_OCI_SUBNET_OCID,
   MOSAIC_OCI_IMAGE_OCID and MOSAIC_OCI_SSH_PUBLIC_KEY.
   These are never committed. Prefer the separate private scheduler described above over changing
   Mosaic Production `main`. The controller requires one of the two
   explicitly reviewed repository names and a real schedule event.
5. Initially leave automatic launch **OFF**. After an approved
   workflow promotion onto the default branch, confirm a successful
   observed report via the workflow's manual dispatch. The manual
   dispatch **cannot launch** (controller requires event=schedule).
   Then, only with explicit consent to the residual billing risk and
   verified quotas, set the three **variables** listed above and
   wait for scheduled runs.

## After one VM is created

GitHub Actions run summary reports instance_created, but no external
email/phone notification is guaranteed. Check GitHub Actions or arrange
workflow-notification preferences. Turn off the auto-launch variable
or disable scheduled workflow. Review OCI Console, billing, compartment
limits and SSH/networking. A newly claimed VM has **no public IP**;
a later, separately reviewed console operation must attach a safe
public endpoint or private access method before Appwrite tests.

This automation cannot promise immediate capacity capture: GitHub cron
runs may be delayed/skipped. Public-repository schedules can be
disabled after 60 days of inactivity. A script with OCI launch rights
cannot be called a purely read-only watcher.

Sources:
- [GitHub schedule only on default branch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [Oracle A1 Always Free quota](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [OCI Compute instance launch](https://docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/cmdref/compute/instance/launch.html)
- [Oracle capacity report](https://docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/cmdref/compute/compute-capacity-report/create.html)
