# Session checkpoint

Updated: 2026-10-12
Current task: #708 chat reliability; stable Preview work. No dev/main or Production promotion.

## Verified state
- Baseline: `dev@b878519` v0.20.6. Stable Preview: `fix/chat-reliability-708-20261012`. Task source: `chatgpt/708-message-reliability-20261012`. Full hardened plan and acceptance gates are in GitHub issue #708.
- Batch: `message-action/deliver` rejects uncertain lookup, conflicting/unsent peer rows and partial sender commits; client validates ack and retries pending transient sends with owner-scoped backoff. Composer retains drafts on failed local save and blocks duplicate submission. Full Sync Now fails rather than deleting an outgoing message missing from its owner's remote rows. Existing global Sync Status/Sync Now is the available manual sync UI; the attempted extra chat shortcut was removed for size.
- Regression tests: handler pair failure, uncertain read, unsent conflict, partial retry; client malformed receipt and timed retry; composer draft/double send; full-sync orphan preservation.
- Candidate version v0.24.0 remains in all three version files (check concurrent feature lines before promotion).
- Canonical Quality Gate SUCCESS for stable 9c296eed (38241874387) and 22613ee3 (38243099608); intermediate task focused runs 38241476695, 38242472808 and 38242961110 SUCCESS.
- Stable Preview head `22613ee3`: Vercel `dpl_BkedDMzXLLFEPZitYucdJMJJsBre` ERROR on appAssetsRaw +475 B, gzip +94 B, precache +282 B; the other four size ceilings passed. Earlier candidates 9c296eed/590ab598 likewise failed size budgets. Do not raise ceilings.
- Repair #3 PR #723 merged stable @ b3e2180d; focused CI 38244421089 SUCCESS, canonical run 38244593303 initiated, but Vercel dpl_ECiz2QcbU4m9DwKmv1rCnCCgDcxT ERROR (raw +382 B, gzip +76 B, precache +189 B). Repair #4 PR #725 merged stable @ 49aaf2d9; focused 38244856284 SUCCESS; Vercel dpl_3GHdmWtKudMb4APuv3wp7Y4xZQCd ERROR (raw +195 B, gzip +18 B, precache +2 B). Current repair task `chatgpt/708-size-guard-log-20261012` trims equivalent logs/owner retry scope without changing behavior.
- Scratch `message-action` Function 6aa8057f002a4c306fdd was last observed live on deployment 6accb9addc5321121ebb. **New server code is not active**. Shared Scratch and Production were not mutated.

## Outstanding acceptance
No READY Preview or Scratch two-account/browser/mobile verification yet. Function exact-SHA deployment needs safe coordination with concurrent Scratch users. Older partial-pair repair, permanent denial UX, latency measurements and cross-device convergence remain unproven. #682 notifications remain deferred.

- Repair #5 PR #727 stable @ 46e2413e, canonical Quality Gate 38245358279 SUCCESS. Initial Vercel git_info_fail; exact-source redeploy dpl_GtyTiU5Mdw8sinM4krGscNMrLm17 built but raw assets +83 B (6/7 budgets pass).
- Current task repair `chatgpt/708-last-size-bytes-20261012`: identical retry scope and shorter diagnostic strings, plus concise failed-local-save notice. No budget increase.

Next action: focused CI, promote repair into stable Preview, verify canonical + Vercel READY against exact SHA; then coordinate Scratch Function build/activation and two-account acceptance separately. No dev/main or Production changes.
