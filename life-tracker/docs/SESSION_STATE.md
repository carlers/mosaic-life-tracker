# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 diagnostic Calendar TaskBlock font-relative geometry A/B, no shipped runtime change.

## Accepted boundary
- Dev v0.29.8 at `bfb0fff0c1c283f599f32db8c2a426416fa65e7b`; the accepted Preview source is `7429dab8b5a9f553e66cbb699d9b2beb1ac42cb7`. Keep #858 OPEN; no further dev/main/Production/1.0 approval.
- Prior Todo offscreen containment lab #39070187878 and Calendar Day View containment lab #39071584460 were synthetic-only. Their 1000-task performance gains did not establish variable-height, Diary, shared or physical-device safety.
- Prior Calendar TaskBlock lab #39072325857 passed; at 1000 same-day text-only tasks Home-ready 409→375ms, but 22px intrinsic size increased Calendar grid scrollHeight 23,285→27,204px (+16.8%). **Reject fixed 22px** and ship none of its CSS.

## Current hypothesis and scope
- Branch `chatgpt/858-calendar-fluid-block-lab-20261018` forks from accepted dev, adds ONLY an independent Playwright diagnostic, isolated push-only GitHub Actions workflow and this checkpoint.
- Same cached-PWA, actual-UI-seeded IndexedDB dataset (25/250/1000 same-day text-only tasks) and held Appwrite; interleave baseline Calendar with two ephemeral variants: `content-visibility:auto` and `contain-intrinsic-size:auto calc(1.5em + 0.125rem)` or `calc(1.5em + 0.25rem)`. Root TaskBlock uses 10.5px font and two 0.125rem top/bottom padding rules; the second hypothesis matches ~19.75px measured actual block height at default root font, but must be falsified in browser.
- Four repeats per mode/variant/count (72 measured launches, 2× CPU, slow-online vs offline), first Home and click timing, full task cardinality, first-block size, Calendar slide scrollHeight and after-bottom/return programmatic scroll geometry. This is research-only; no runtime/deployment/version modification. No numeric browser measurement is a phone SLA.
- Variable content, responsive accessibility fonts, photos, Diary/shared, genuine input/keyboard and installed devices remain unverified. Do not ship containment unless safety is established with those separate tests.

## Next
- Inspect exact diagnostic Action SHA/results and matched pairs (not historical cross-run absolute medians). If font-based placeholders still alter geometry or benefits are marginal, reject without production change. If promising, expand to realistic/adversarial content and actual device acceptance before proposing implementation. Full user-testable candidate must follow focused, stable Preview canonical, Scratch deployment and owner acceptance. Keep #858 OPEN.
