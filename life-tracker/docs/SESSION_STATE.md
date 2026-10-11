# Session checkpoint

Updated: 2026-10-12
Current task: User-approved cleanup and promotion of Bucket List #405 to dev, including linked-task photo viewing.

## Live integration context
- User manually accepted Bucket List v0.19.2 and authorized cleanup/polish and merge to `dev`. Source is stable `feature/bucket-list-405@4bac2e86d54e2b32e620e90307e33cd4ee23b9b8` with canonical run 38157675597 SUCCESS and Vercel exact-SHA READY. Current integration base `dev@48005f0f9327a0ac5d028f2615034a5e2c1ed80f`, version 0.17.9; main remains 0.17.4. Do not touch Production or promote to main.
- Branch histories diverged by 13 accepted commits each since merge base `832fc932`. Do not direct-promote a conflicting or different integration tree. Instead re-accept exact integrated tree on a **new stable Preview** `feature/bucket-list-405-integrated` before creating dev PR.
- Integrated tree starts from all accepted feature code and layers **13 dev-only changed files** by their exact blob SHA, preserving current cross-device photo SDK/session/retry fixes and newer tests. Reconcile 8 overlapped files: use Bucket List v0.19.2 package and appVersion; retain latest dev no-border hamburger/settings icons alongside new Bucket List menu actions; carry Bucket List v4 backup while adopting dev's `guardedStorage.downloadFileBlob` path (required for third-party-cookie blocked browsers); review the build-size budget difference against dev with full canonical/providermetric check; replace stale session handoff with this integration record.
- Important: integrated export must continue including `bucketList` and `bucketTaskLinks` v4, as well as authenticated blob retrieval for existing image attachments. No unintended UI/design changes. No backend writes; Scratch target already has migration 011 and active combined `message-action@6acbb81e4a02f7368340` verified on prior work, recheck live before promotion.

## Next action
- Run [verify:focused] on `chatgpt/integrate-bucket-list-405-dev-20261012`, repair failures. Squash PR to `feature/bucket-list-405-integrated` (based from the exact dev SHA above), run complete canonical and exact Vercel READY on stable integrated tree; review build-size guard independently for both GitHub and GIPHY-enabled Vercel. Recheck live `dev`, backend, CI and accepted source. If safe, create PR and merge integrated Preview -> `dev` with descriptive merge commit; verify post-promotion provenance, checks and Vercel. Preserve `main`/Production. Keep #405 open until production release. Report all completed checks and remaining manual checks.
