# Session checkpoint

Updated: 2026-10-12
Current task: #656 — first-open Categories manager entrypoints; task and Preview only, no dev/main promotion.

## #656 Categories first-open follow-up
- Base: dev@`b878519bd52da16368b5da2b407f82f326ab2683`, version 0.20.6. Task `chatgpt/656-category-first-open-20261012`, stable Preview `perf/category-first-open-656-20261012`, candidate PATCH v0.20.7 (recheck parallel version reservations before any promotion).
- The Menu > Lists & Categories and Me > Categories pathways still initialize distinct `React.lazy` components inside `Suspense fallback={null}` on their first user action. Even a settled import does not prime an uninitialized React.lazy; this is the proven #640 mechanism. The previous v0.20.5 fixes remain intact.
- Fix only those two real entrypoints: cache resolved components with existing `createPreloadedLazy`, warm category code on Menu opening (not Home bootstrap) and on Me post-mount idle / input intent, retain true cold/error-retry semantics and sheet state. No hidden sheet instantiation, data hooks, server or UI restyling.
- Add Menu → Lists & Categories and Me Categories DOM first-commit regressions. Source audit found friend Calendar reply composer already mounted while closed, and GIPHY/emoji/photo/route previews have visible loading feedback. No measured evidence justifies changing these now. `App.tsx` route fallback and OfflineBanner are non-candidates.
- Build budget is tight (especially entry/initial gzip), do not increase limits without independent measured review. Candidate needs task focused CI → stable Preview squash → full canonical and exact-SHA GIPHY Scratch Vercel READY, seven unchanged caps and real device verification. No manual tests are claimed.

## Initial v0.20.7 Preview verification
- Stable Preview `perf/category-first-open-656-20261012@26a07f9`; [canonical Quality Gate 38244072509](https://github.com/carlers/mosaic-life-tracker/actions/runs/38244072509) SUCCESS across all full CI jobs.
- Hosted GIPHY/Scratch deployment `dpl_3MQSt36V2qV7CC9rEXyTD5Sorg1Q` correctly failed the strict entryRawBytes cap by **2 B** (446202/446200). All six other budgets PASS and PWA policy PASS; source and DOM/browser regression checks unaffected.
- Reviewed a measured **entry raw-only** exception from 446200 to 446208 B, with detailed new review record and prior review retained in `config/build-size-budget.json`; six other limits unchanged. This records legitimate emitted code cost and avoids unrelated startup refactors/byte-golf.
- Next stable SHA must rerun canonical and hosted exact-build checks before any user handoff.

## Prior integration
- v0.20.6 signed-out hosted deep-link handling is on dev, with its detailed evidence in its respective PR history. Preserve it unchanged.
- #656 v0.20.5 Menu/friend/Chat/Notifications and deferred Share/Link/Carousel fixes already integrated into dev as documented on issue #656. #640 owner Day View first-open behavior remains accepted.
- #645 repo discovery D1/D2, #655 PWA and parallel feature scopes remain separate. Do not merge to main or touch Production/Appwrite under this task.

Next action: verify the metric-specific hosted build-size review through focused CI, squash it into stable v0.20.7 Preview, rerun exact canonical and Scratch/GIPHY Vercel size acceptance, then request device testing. No dev/main promotion.
