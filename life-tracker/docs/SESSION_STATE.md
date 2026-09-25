# Session checkpoint

Updated: 2026-09-25
Current task: Fix calendar month scrolling and horizontal transition stability.
Status: The prior split made the Embla viewport non-scrollable, which prevented vertical scrolling. The current fix keeps the horizontal Embla viewport fixed and moves vertical scrolling onto each month/slide, with a stable scrollbar gutter so month-to-month scrollbar presence cannot resize the horizontal viewport. Regression coverage pins the per-slide scroll contract.
Next action: exact-SHA canonical acceptance, Preview delivery, and merge to dev.
Blockers: Local runtime execution is unavailable; remote CI is the executable verification path. Real touch/scroll acceptance remains separate and must not be inferred from automated tests.


## Phase 1 findings

- Appwrite project: Mosaic, Singapore region, TablesDB database life_tracker.
- settings table had insufficient isolation; table create is now authenticated-users-only and row security is enabled.
- friendships table create is now authenticated-users-only and row security is enabled.
- task_images bucket now uses authenticated-user creation, per-file security, 5 MB size limit, explicit image extensions, encryption, antivirus, and transformations.
- Unused Appwrite auth methods (anonymous, phone, JWT, invites, email OTP) are disabled; email/password and magic-link remain enabled.
- message-action Function execution is restricted to authenticated users; existing backend scopes and daily schedule remain configured.
- Existing data tables otherwise use row security with user-scoped permissions, with profiles intentionally readable to authenticated users for social search.
- Appwrite Web platforms currently include the laptop development host and the exact Vercel production hostname `mosaic-life-tracker.vercel.app`; the former `*.vercel.app` wildcard has been narrowed.
- PostHog project is configured but currently reports no ingested events and no event activity in the last 30 days. Repository search found no PostHog SDK runtime integration; the existing PostHog Rollup plugin is only configured for optional source-map upload when explicitly enabled by build secrets.
- CI previously used `npm ci --no-audit`; the full canonical workflow now adds a blocking `npm audit --omit=dev --audit-level=high` job for production dependencies.

## Working set

- Appwrite live configuration
- .github/workflows/quality-gate.yml
- life-tracker/docs/SESSION_STATE.md

## Verification

- Appwrite live configuration reads and writes completed successfully.
- PostHog project and event-schema reads completed successfully.
- PR #14 dependency-audit plus the existing canonical suite passed on exact SHA 04b38bc3c9a7005fa3a6f01c4dd51c021e2a2396 (Quality Gate run 36092048112).
- PR #14 merged into dev as merge SHA 625948dbcd0d66ccec1501746e6d023971951815.
- Manual hosted production/device acceptance: pending.
- Phase 2 release hardening passed canonical acceptance on exact SHA b2c08ab22b0a3820ca2221d0f4cc5071d1eaa6ff (Quality Gate run 36094432195) and merged into dev as ecf7a8767c3bac5dd2a1cb9739fdf5c5e154e041; Vercel dev deployment is READY.
- Vercel build measurement: entry 425,915 B raw / 126,874 B gzip; all app assets 1,927,766 B raw / 577,915 B gzip; precache 1,988,488 B; build-size budget passed but app-assets and precache budgets are close to their configured ceilings.
- Vercel build reported an ineffective dynamic import for socialOutbox because the module is also statically imported; Phase 3 removes that redundant dynamic import without changing behavior.
- Phase 3 also gates bootstrap informational console logs behind DEV; warnings/errors remain available for production diagnostics.
- Manual hosted/device acceptance remains pending.
