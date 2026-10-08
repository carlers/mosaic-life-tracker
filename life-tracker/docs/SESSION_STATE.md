# Session checkpoint

Updated: 2026-10-08
Task: Establish isolated scratch-backed Vercel Preview and activate/test
notifications backend before dev/main promotion.
Base: `feature/notifications-alerts` at `1d21ebe9906b932646463c5d45ce14ac28b68833`.
Task branch: `chatgpt/scratch-preview-isolation`; no dev/main promotion.

## Confirmed cloud state and work performed

- Production Appwrite project `6a9703c50016b37110ff` (sgp) and scratch
  `6a96e82d000d1310b3be` (fra) are distinct. The old Vercel Preview
  build used the official production fallback because no `VITE_APPWRITE_*`
  Preview variables were previously configured.
- Added Preview-only project ID, regional endpoint, and Function ID in the
  existing Vercel project `mosaic-life-tracker`. Production env was untouched.
  **Existing older Preview deployment URLs are not retargeted by env changes.**
- Registered Appwrite scratch Web platform
  `mosaic-life-tracker-git-feature-beac29-carls-projects-72516fde.vercel.app`.
- Applied scratch-only `006-push-details`: `push_subscriptions.include_task_details`
  is available with boolean type, optional and `false` default.
- Uploaded the nine checked-in `appwrite-functions/message-action` files from
  exact feature commit `1d21ebe9906b932646463c5d45ce14ac28b68833` to
  scratch as inactive deployment `6ac77056dfae4233346e`. Existing active
  deployment remains `6ac7147c94b176f3cac4` until activation.
- Added an explicit build-time Preview backend guard in
  `scripts/lib/preview-backend-isolation.mjs` and `vite.config.ts`, with
  unit regression cases. The official scratch project ID and fra endpoint are
  required for every Vercel Preview; production build remains unchanged.

## Scratch active deployment and Preview build repair

- Scratch Function deployment `6ac77056dfae4233346e` reached READY, was
  explicitly activated, and read-back confirmed as active. It was built from
  exact notification source SHA `1d21ebe9`; no production Function change.
- Isolation PR #377 passed focused CI and merged to the stable feature Preview
  at `5b0dded`. On that tree, Vercel/CI production builds found TS7016:
  `vite.config.ts` could not resolve the type declaration of the `.mjs`
  isolation helper. Follow-up task branch
  `chatgpt/scratch-preview-isolation-types` converts the helper to `.ts`
  so Vite/TypeScript and Vitest share one typed implementation.
- Rebuild and verify the newest Preview targets scratch, not merely that
  Vercel deploys a static bundle. Production Appwrite remains untouched.

## 2026-10-08 Preview login origin repair

- Latest feature Preview `dc9baa40dbda578d6a4adae7f47648cc74bdd5a1`
  passed full canonical GitHub CI and Vercel deployment READY. Its
  registered stable branch alias resolves `/login` with HTTP 200.
- User tested the immutable deployment URL
  `mosaic-life-tracker-n73x4jbnd-carls-projects-72516fde.vercel.app`
  and reported `Failed to fetch` on login. Scratch Appwrite Web
  platforms contained *only* the stable alias, not that URL's hostname.
  This is a browser-origin/CORS mismatch, not a missing database table.
- Registered the exact immutable URL as scratch-only Appwrite Web
  platform `mosaic_notifs_dc9baa`. Verified by re-reading the list:
  stable alias and immutable URL are both present. The production
  Appwrite project and Vercel production variables were not touched.
- Share the stable branch alias for authenticated Preview access.
  Updated delivery/backend/mobile-notification docs so agents check
  the Appwrite Web-platform allowlist before handing off any new
  immutable Vercel Preview URL. Browser login acceptance remains
  unverified from an actual signed-in device: the provider connector
  proves configuration, not browser CORS or credentials.
- Only advance to dev/main on explicit user approval and after the
  previously pending installed-PWA/device notification acceptance.

## Remaining execution gates

1. Inspect scratch Function deployment build; if ready, activate only that
   deployment, verify active ID and smoke-test the Function. Diagnose/fix
   failures before claim of backend acceptance.
2. Run focused CI on the task branch; squash into stable
   `feature/notifications-alerts` Preview and verify canonical CI +
   a fresh Vercel READY deployment with the scratch target.
3. Confirm the re-built Preview is linked to scratch (not merely Vercel READY),
   and validate notification detail GET/SET plus safe task navigation using
   disposable scratch accounts where possible.
4. Manual Samsung installed-PWA push permission, actual foreground/background
   delivery and lock-screen rich content require real device verification.
   Production Appwrite remains untouched; no merge to dev or main.
