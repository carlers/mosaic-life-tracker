# Documentation/workflow consolidation — 2026-09-24

Baseline: `9a89938` (the previous test consolidation). This report records the
migration once; GitHub check runs and deployment status remain the delivery record.

## Document disposition

- Root README/AGENTS remain small discovery entrypoints; a repository-root AGENTS
  routes sessions started above the application directory.
- PLAN and SESSION_STATE moved into docs; all maintained local links are checked.
- CODEX_WORKFLOW, WEB_CHAT_WORKFLOW, and CHATGPT_GITHUB_CONNECTOR_WORKFLOW merged
  into AI_WORKFLOW. REMOTE_VERIFY and PREVIEW_DEPLOYMENT merged into DELIVERY.
- Obsolete component-tree removed; valid UI/data constraints remain in project reference.
- Bundle/test audit evidence and reference changelog moved to this archive.
- Product/architecture section numbers remain stable. Stale progress and test totals
  were replaced by roadmap links and executable discovery/runner results.
- Telemetry/evidence tools remain available, but mandatory response bureaucracy and
  prompt copying were removed. Existing metrics ledgers no longer activate handoff logging.

## Matched fixed-overhead measurement

Same chat-plan target, empty working set, clean Git status, 40-character SHA,
branch `chatgpt/docs-workflow`, and identical short checkpoint fixture on both versions.
The old packet also automatically embedded the old roadmap and web-chat guide; the
new packet embeds only essential instructions and checkpoint. No selected source files.
Token estimates use the generator's `ceil(characters / 4)`, not provider usage receipts.

| Measure | Before | After |
|---|---:|---:|
| Project AGENTS characters | 21,338 | 3,084 |
| Additional repository-root entrypoint | 0 | 267 |
| Fixed packet estimated tokens | 8,068 | 1,015 |

Fixed packet overhead fell **87.4%**, exceeding the 50% target and staying below
3,000 estimated tokens. A regression checks that budget against the real instructions
and checkpoint. File content remains exact and untruncated; large working sets still
receive the existing advisory warning.

No end-to-end task wall-time improvement is claimed from this text-size measurement.
The workflow removes repeated mandatory reads/reports and duplicate local acceptance
runs; canonical CI gates, fresh build installation, caches, and shard counts are retained.

## Verification

Local contracts, discovery, changed-test lint, and 35 focused tooling cases passed.
Coverage includes migrated state, aliases, deduplicated packets, remote exact-SHA
references, dirty/deleted/renamed/unpublished checkpoints, opt-in telemetry, safe paths,
link examples/IDE suffixes, and installer dry-run with the moved checkpoint.
Final canonical CI and Preview are verified against the delivered commit rather than
recorded through a later status-only commit.
