# GitHub-hosted A1 capacity claim — DORMANT until approved (#975)

**Purpose:** User cannot keep Fedora powered on, wants GitHub to check
Oracle Singapore A1 capacity hourly and, once a slot is likely available,
claim one *specific* Always Free-sized ARM VM automatically.

**Current status: NOT ACTIVE.** This workflow is prepared only on an
isolated Preview branch. GitHub's scheduled workflows run **only from a
repository's default branch**. Mosaic's default branch is protected
Production main; this workflow must **not** be promoted to main without
the owner's separate explicit production-branch approval. It also needs
a dedicated OCI IAM identity and encrypted GitHub secrets installed by
the owner, which are deliberately unavailable to this chat.

## Two modes and their protections

Workflow: ../../.github/workflows/oci-a1-autoclaim.yml.
Controller: ../scripts/oci-a1-autoclaim.mjs.

- **Observe (default):** Once per hour at minute 17 UTC, run the same
  advisory report from OCI for ap-singapore-1, AD-1, exact A1 2 OCPU /
  12 GiB. Does not launch VM. An AVAILABLE report still can race
  against another requester.
- **Auto-claim (opt-in only):** Requires the repository variable
  MOSAIC_OCI_AUTOLAUNCH set to literal true, plus independent variables
  MOSAIC_OCI_FREE_TIER_CONFIRMED=CONFIRMED and
  MOSAIC_OCI_QUOTA_CONFIRMED=CONFIRMED. Code independently verifies
  the scheduled workflow runs on the exact default-branch ref of
  carlers/mosaic-life-tracker, positive available-count, no prior A1
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
   These are never committed. Prefer a separate private scheduler
   repository to keep automation credentials away from the Mosaic
   production codebase; the supplied workflow/controller are
   initially hard-guarded to this repository and would need a
   separately reviewed adaptation for a dedicated repo.
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
