# Session state

Updated: 2026-09-24
Current task: Adjacent-route content preload + Settings version/update progress + Me friends count + branch cleanup
Status: in progress.

## Active user prompt

> ok good. next task: maybe we can lazy pre load either side of the mounted route so that u can see the content even while dragging. keep it optimized tho. also lets add version numbers in settings page, this one will be version 0.0.1. make check for updates loading state show more feedback instead of js showing the word "checking", so the user knows what stage it's in, if it found an update, is pulling it, downloading it, etc. and put the button above the delete user data  buttons. and change followers to friends in me page and actually reflect the number of freidns u have. cleanup github branches after,

## Progress

1. **Done — recover Preview baseline and rules.** Preview is `591ad28745b2f1f91f329936aa56c2d7536137e4`; read current agent/session/roadmap/product/verification/deployment guidance.
2. **Done — inspect current route preview, PWA update lifecycle, Settings, version source, and Me social stats.** Route chunks already preload after idle but drag currently renders route-shaped shells rather than actual adjacent content. Settings hard-codes version `0.0.0`, update check exposes only a boolean `Checking…`, and the update button sits below destructive controls. Me hard-codes Following/Followers counts to zero even though `FriendsProvider` already owns accepted friendships.
3. **Done — update durable contracts + red regressions.** Verify #257 (`35958477790`) captured intended red evidence: route preview still rendered the shell, release `0.0.1` was absent, Me still showed the hard-coded Followers stat, new preload-target/version modules were missing, and staged PWA/Settings update feedback assertions failed.
4. **In progress — implement optimized adjacent content preview.** Both reachable route chunks are selected deterministically and idle-prefetched; no hidden neighbor route tree mounts at app startup. On direction lock, only the active neighbor mounts through React.lazy/Suspense, so a preloaded chunk shows real content under the drag while the lightweight shell remains the fallback.
5. **In progress — implement Settings/version/update progress.** Release metadata is `0.0.1`; PWA checks now report preparing/checking/update-found/downloading/ready/current/unavailable stages, and Settings exposes that live status above destructive controls while preserving explicit Update now activation.
6. **In progress — implement Me friends stat.** Me now reuses shared `useFriends()` and displays accepted `friends.length` under Friends without adding any subscription.
4. **Pending — implement optimized adjacent content preview.** Keep both reachable chunks idle-prefetched but mount only the drag-direction neighbor on gesture lock; use Suspense shell fallback, no hidden full-route mounts, no per-frame React state.
5. **Pending — implement Settings/version/update progress.** Make `0.0.1` the release version, expose meaningful update-check stages from the PWA lifecycle, keep update activation explicit, and move version/update controls above destructive data actions.
6. **Pending — implement Me friends stat.** Rename Followers → Friends and bind its number to accepted `friends.length` without adding another subscription.
7. **Pending — focused/browser verification + evidence review.** Capture red→green evidence for preview content mounting, update stages/order/version, and friend count; review mount/per-frame work.
8. **Pending — final acceptance/Preview/deployment.** Require exact `[verify:full]` green, move Preview, confirm Vercel READY.
9. **Pending — GitHub branch cleanup.** After the final Preview SHA is green/READY, delete stale AI-owned `chatgpt/**` branches including this task branch; preserve `main`, `preview`, and non-AI/user-owned branches.

Roadmap pointer: primary-route performance/interaction + Settings release UX.
Blockers: None.
