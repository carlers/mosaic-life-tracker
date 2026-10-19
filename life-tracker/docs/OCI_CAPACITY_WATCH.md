# Oracle Singapore A1 Always Free: local capacity watcher (#975)

**Status:** source-only **local** tool requiring an OCI CLI profile on **your own**
laptop. This local mode has no unattended scheduler. A separate, dormant,
security-reviewed [GitHub A1 automation](OCI_GITHUB_A1_AUTOMATION.md) is being
prepared for an owner-approved scheduled deployment using a **dedicated** IAM
signing identity in encrypted GitHub secrets. Never commit any OCI credentials,
share private keys in chat, or use an account administrator API key.

## One-time setup

Install the [official OCI CLI](https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm)
and configure a **dedicated read-only local profile** with
`oci setup config` (Oracle's documented setup flow). Choose your Singapore
tenancy. Store the profile and signing-key file outside this repository,
restrict their permissions, and never paste the private key or config here.

The profile's IAM principal must be authorized to **list availability domains
and generate compute capacity reports for the tenancy root compartment**.
If OCI replies `NotAuthorizedOrNotFound`, request the minimum privileges
rather than granting instance/volume/network creation rights. Generate
reports only; do not create reservations or instances.

From `life-tracker/`, after your local CLI works:

```bash
npm run oci:capacity -- --once --json
# Or, if you configured an isolated custom profile:
npm run oci:capacity -- --once --profile MOSAIC_READONLY
```

The script gets the full tenancy-specific availability-domain name using
`oci iam availability-domain list`, then requests an official
`oci compute compute-capacity-report create` with **only**
`VM.Standard.A1.Flex`, **2 OCPUs, 12 GB RAM**, region `ap-singapore-1`,
and the required tenancy-root compartment ID. Despite the API verb
`create`, this action generates a capacity **report**, **not** a VM,
reservation or billable compute resource.

For a periodic terminal watcher:

```bash
npm run oci:capacity -- --watch --interval-minutes 60
```

The interval has a hard lower bound of 15 minutes. The terminal must
remain running and online. When a capacity report reports
`AVAILABLE` with a positive `availableCount`, it prints an alert
(and terminal bell) suggesting you **manually** revisit Oracle's
creation wizard. It never automatically provisions an instance or
changes billing settings. Use Ctrl+C to stop. Missing/contradictory
capacity data, unknown statuses and CLI failures never imply capacity.

**Important:** report availability is advisory only. You might still
receive `Out of host capacity` on the actual VM creation request. The
report does not certify your tenancy's Always Free quotas, storage
eligibility, VM pricing, or the ability to reserve capacity.

## Safety boundaries

- Fixed Singapore region and A1 2-OCPU/12-GB request; no dynamic shape.
- Uses process spawning with explicit arguments, not a shell.
- Does **not** send credentials to this project or print raw CLI errors.
- No GitHub Actions scheduled watcher: Oracle API private keys stay
  entirely on your own machine.
- Only IAM availability-domain list and Compute capacity report commands.
- Never calls launch-instance, create-reservation, block volume, or network APIs.
- No public-facing health endpoint or credentials required.
- Continue all self-hosting, auth, backups, and OCI no-charge feasibility gates
  in [#975](https://github.com/carlers/mosaic-life-tracker/issues/975).

Sources:
- [OCI CLI capacity report reference](https://docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/cmdref/compute/compute-capacity-report/create.html)
- [OCI CLI availability domains](https://docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/cmdref/iam/availability-domain/list.html)
- [Capacity report model and statuses](https://docs.oracle.com/en-us/iaas/tools/ruby/latest/OCI/Core/Models/CapacityReportShapeAvailability.html).
