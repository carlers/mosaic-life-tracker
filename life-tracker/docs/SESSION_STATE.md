# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1008 extend WebKit across the complete Playwright browser correctness suite, without Appwrite.

## Boundary
- Base: stable Preview `fix/ios-task-input-webkit-1008-20261019@82840a2c866acf4ff92f5127185df87c7a8f76fd` (v0.29.13); protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` and `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` are unmodified.
- Task: `chatgpt/1008-webkit-full-browser-suite-20261019`; no product runtime or data/backend/security pin changes. Version impact NONE (keep v0.29.13).
- Appwrite is unavailable for owner manual verification; no promotion to dev/main or 1.0 authorized. Post-1.0 Firefox issue #1009 remains planning only.

## Scope
- Replace first-shard-only WebKit task-input smoke run with all non-performance Playwright browser correctness specs, same shard split as Chromium on both existing CI runners.
- Preserve the protected-main-reviewed Quality Gate YAML byte-for-byte and its trusted deployment receiver; keep browser runner and workflow contracts explicit.
- Use native WebKit user agent, phone-sized default plus iPad task-entry viewport; keep Chromium-only trusted CDP touch drags explicitly reported as WebKit skips rather than fabricating cross-browser touch coverage.
- Keep Vitest unit, handler, and DOM suites unchanged (engine-independent), diagnostic `@performance` excluded from acceptance, and native iPad Safari/PWA testing pending.

## Prior verified
- #1008 v0.29.13 task blur-save Preview canonical #39219337007 SUCCESS and Trusted Preview Delivery #39219583581 SUCCESS at base SHA, with Vercel READY CLI readback.
- Expanded task CI #39223047500: focused checks SUCCESS; Chromium both shards SUCCESS; WebKit shard 2 SUCCESS (16 passed, 15 CDP-only skips). WebKit shard 1 revealed three cases (24 passed, 5 CDP-only skips): two desktop wheel tests invoked on unsupported mobile WebKit, and one chat test raced the loaded message list after route transition. Repairs are on the task branch, not yet reverified. No accepted full WebKit suite or Preview for this revision yet.

## Next safe action
- Run focused + browser CI on a coherent task commit; repair real engine-specific failures. After green, squash into stable Preview and confirm canonical CI, trusted receiver and matching READY deployment. No dev/main promotion without explicit approval.
