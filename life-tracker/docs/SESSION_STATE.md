# Session checkpoint

Updated: 2026-09-25
Current task: Production launch hardening — Phase 1 security and service configuration audit.
Status: Live Appwrite production configuration was audited and the highest-confidence access-control issues were corrected. The CI canonical gate now includes a production dependency vulnerability audit. PostHog was inspected live and confirmed to have no recent Mosaic application telemetry.
Next action: verify the dependency audit on the task SHA, then continue repository-side production configuration and release preparation.
Blockers: Production hostname is not yet established in repository-visible configuration; local runtime execution is unavailable, so remote CI remains the executable verification path.

## Phase 1 findings

- Appwrite project: Mosaic, Singapore region, TablesDB database life_tracker.
- settings table had insufficient isolation; table create is now authenticated-users-only and row security is enabled.
- friendships table create is now authenticated-users-only and row security is enabled.
- task_images bucket now uses authenticated-user creation, per-file security, 5 MB size limit, explicit image extensions, encryption, antivirus, and transformations.
- Unused Appwrite auth methods (anonymous, phone, JWT, invites, email OTP) are disabled; email/password and magic-link remain enabled.
- message-action Function execution is restricted to authenticated users; existing backend scopes and daily schedule remain configured.
- Existing data tables otherwise use row security with user-scoped permissions, with profiles intentionally readable to authenticated users for social search.
- Appwrite Web platforms currently include the laptop development host and *.vercel.app; production should receive a dedicated stable hostname platform before launch.
- PostHog project is configured but currently reports no ingested events and no event activity in the last 30 days. Repository search found no PostHog SDK runtime integration; the existing PostHog Rollup plugin is only configured for optional source-map upload when explicitly enabled by build secrets.
- CI previously used `npm ci --no-audit`; the full canonical workflow now adds a blocking `npm audit --omit=dev --audit-level=high` job for production dependencies.

## Working set

- .github/workflows/quality-gate.yml
- life-tracker/docs/SESSION_STATE.md

## Verification

- Appwrite live configuration reads and writes completed successfully.
- PostHog project and event-schema reads completed successfully; no application telemetry is being inferred beyond the returned project data.
- Automated repository verification: dependency-audit plus the existing canonical suite pending on the new commit.
- Manual hosted production/device acceptance: pending.
