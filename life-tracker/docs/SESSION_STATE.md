# Session checkpoint

Updated: 2026-10-14
Current task: #784 evidence-backed startup/Home size-policy transition.

## Verified baseline

Protected dev d7656e2513e5ee9d339814890cd7f707f18461d6.
Prior task branch chatgpt/784-mobile-startup-audit-20261013 demonstrated
no-Vercel Chromium cold startup audit: Actions #38424472937 attempts 1/2 PASS,
focused Quality Gate #38425230670 SUCCESS, and controlled eager import
#38426273139 SUCCESS. Eager Notifications increased initial closure by
203914 B gzip, Home closure 52682 B but *reduced* total app gzip by
8104 B; Login FCP worsened about 1.15 seconds. Measurements are
synthetic, not real-phone or signed-in production timings.

## Active implementation

Same task branch now transitions from historical seven hard size ceilings
to two reviewed startup/Home closure blockers with broad headroom
(154500 B initial, 381000 B Home), retaining all seven measurements
and warning-only thresholds for other five. Existing PWA correctness,
fingerprinting, backend isolation, canonical source acceptance and
the #592 Vercel-quota workflows remain unchanged. Validated policy-change
audit record protects against silent future disabling of blockers.
Added tests for warning-only growth, eager regression, malformed policy
and unauthorized weakening. Advisory mobile audit now has no task-push
or experiment mutation and is scheduled Mon/Thu only if explicitly
placed on default main; until then it is inactive.

## Next action

Run focused task SHA verifying changed scripts, unit tests, docs and
budget-policy review before any stable Preview. Investigate failures;
then verify full canonical contract on a deliberate stable Preview
without routine Vercel waste, and coordinate #592 deployment acceptance.
Protected dev/main promotions and rollout require their established
approval gates. No production/runtime Appwrite change or device test
has been performed. Keep #784 open until verified rollout and
#592 independent quota-safe delivery evidence.
