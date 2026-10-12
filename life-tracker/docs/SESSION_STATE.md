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
- Current repair `chatgpt/708-size-guard-final-20261012`: shrink retry/receipt code, preserve same behavior. Focused CI must pass before another stable Preview promotion.
- Scratch `message-action` Function 6aa8057f002a4c306fdd was last observed live on deployment 6accb9addc5321121ebb. **New server code is not active**. Shared Scratch and Production were not mutated.

## Outstanding acceptance
No READY Preview or Scratch two-account/browser/mobile verification yet. Function exact-SHA deployment needs safe coordination with concurrent Scratch users. Older partial-pair repair, permanent denial UX, latency measurements and cross-device convergence remain unproven. #682 notifications remain deferred.

Next action: pass focused CI, squash-repair stable Preview, verify full canonical and Vercel READY at exact SHA. Then coordinate Scratch Function and disposable-account acceptance separately. Do not merge to dev/main or touch Production without approval.
