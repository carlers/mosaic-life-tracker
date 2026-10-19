# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 isolated browser Dexie/IndexedDB replication persistence across reopen.

## Source / safety
- Latest accepted isolated stable Preview `refactor/967-rxdb-native-pilot-20261019@10b32b7519d70b9665697d40fb787187b9dc5d01`; focused #39194176376, full canonical #39194289798, trusted #39194473780 all SUCCESS, trusted prebuilt READY for exact source.
- Task branch `chatgpt/967-rxdb-dexie-restart-20261019`, based on accepted source. **No shipped Mosaic runtime imports, Appwrite, dev/main/Production, hosted Supabase schema/Auth/rows or provider switch.** Issue #967 OPEN.
- Prior signed local Supabase Auth/PostgREST/RLS/CAS integration #39192772712 SUCCESS but separate from browser persistence; hosted signed-user proof and two privileged-RPC warnings outstanding.

## Work
- Add an isolated Playwright HTML + TypeScript browser fixture that instantiates actual RxDB v17, native replication and Dexie/IndexedDB with the source-only `candidateRxdbPilot`.
- Fake remote owner/category rows live separately in browser sessionStorage, explicitly NOT a real HTTP, SQL or Auth server. Playwright tests first pull + saved cursor, close RxDB and reload browser, simulate independent second remote revision, assert resumed first pull checkpoint rather than full replay.
- Simulate the remote going offline after initial sync, edit a real local RxDB document, verify failed push leaves the remote unchanged and the local edit in IndexedDB, close/reload and reconnect, verify the pending local edit reaches remote. No changes to app UI or database and no external network.

## Verification
- First browser Quality Gate #39195032903 failed before executing the test due to the local Vite HTTPS self-signed certificate. Follow repository E2E fixture convention with Playwright ignoreHTTPSErrors on this isolated test only. Documentation focused check also required explicit '## Next action' heading; fixed.
- Corrected task browser verification [verify:browser] pending. Report/repair any timeout or RxDB integration failure before isolated stable Preview merge. No assertion of browser persistence until the actual Playwright job passes.
- New browser fixture does not establish cloud signed Auth or real-network/mobile PWA durability; hosted Auth/RPC security and multi-device acceptance still need independent proof.

## Next action
- Run browser + focused test gates, repair failures, then squash into fresh isolated stable Preview for canonical full and trusted CI-first delivery. Post issue #967 exact SHA evidence. Keep issue OPEN; no dev/main promotion, Production backend change or 1.0 release.
