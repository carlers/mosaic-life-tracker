# Session state

Updated: 2026-09-19
Current task: Phase 3.1 — production bundle audit
Status: complete; awaiting commit approval
Roadmap pointer: `PLAN.md` — Phase 3.1 complete, Phase 3.2 proposed
Next action: Review `docs/BUNDLE_AUDIT.md`, then agree Phase 3.2 scope and schedule the service-worker activation prerequisite.
Blockers: none for the audit; activation policy needs agreement before releasing split chunks.

## Findings and temporary decisions

- Baseline: main JS 1,718,857 raw / 497,244 gzip bytes (Node gzip defaults).
  Every page is eager; only PhotoSwipe's core is already a dynamic app chunk.
- Home also imports the emoji picker and image compressor. Route splitting alone
  will not defer those dependencies when Home opens.
- The generated worker calls `skipWaiting()` and `clientsClaim()` despite the false
  flags in `vite.config.ts`: the PWA plugin overrides them for `autoUpdate`.
  PWA-4 config comments describe intent; the project reference now records the mismatch.
- Recommend addressing that narrow Phase 3.5 issue before deploying Phase 3.2.
  Runtime fixes, broader PWA UX, and the next batch remain unapproved.
- Precache includes dynamic chunks. Preserve offline-route access when splitting.

## Verification

- `npm run build` passed; existing large-chunk warning recorded.
- `node scripts/audit-bundle.mjs` passed; all diagnostic artifacts matched the
  normal build byte-for-byte. Metadata is written to a unique OS temporary directory.
- Script syntax check, repository lint, local document links, roadmap consistency,
  diff review, and `git diff --check` passed.
- No runtime changes or new browser-performance claims. Runtime tests were not
  rerun for this audit; historical baseline on 2026-09-18 was 390 passing tests.

## Unfinished changes

- Pending commit: bundle audit report and reusable diagnostic script, plus roadmap,
  README, reference note, and this handoff. No dependency or runtime configuration changes.
- Phase 3.2 and later backlog remain in `PLAN.md`; none started by this batch.
