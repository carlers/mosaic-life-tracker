# Session checkpoint

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
