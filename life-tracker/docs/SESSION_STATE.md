# Session checkpoint
Updated: 2026-10-30 Asia/Manila
Current task: #1027 safe personal Preview prerelease denial/logout, v0.48.2. Production not approved.

## Verified state
- Stable isolated Preview is `feature/1027-supabase-recovery-20261020@6b25c74`; protected v0.48.1 deployment succeeded. `dev`, `main`, Production unchanged.
- Owner verified real Gmail recovery email (Spam), password reset/new-password login, Proton confirmation email (Inbox), code redemption and sign-in. Both accounts reach new-data choice, then show uncertain writer-shutdown warning; logout is blocked. No onboarding/sync acceptance.
- Read-only `mosaic-dev`: zero non-null `personal_release_evidence` markers; `mosaic_personal_readiness` returns `personalReady:false`. This is the authorized release stop, not permission to set the marker. Leave personal writer fence, signup policy, SMTP and R2 backups untouched.
- Source defect: personal bootstrap marked writer-attempted before a candidate runtime checked release readiness, so a pre-lease denial became a hard blocked session. An actual uncertain writer stop must **remain** hard blocked.

## Task
- Branch `chatgpt/1027-prewriter-release-denial-20261030`, v0.48.2: signed readiness check before writer attempt; typed pending release error and safe login/logout UI, while preserving all guards. Targeted unit and DOM regressions added.
- Focused CI #41015879363: source/unit/DOM 2672 passed, one failed: `documentationContracts` default handoff 3246 > 3000 estimated tokens from an oversized checkpoint. This shorter checkpoint repairs the cause; CI rerun required. No canonical Preview or deployment yet.
## Next action
- After focused green: fast-forward stable Preview only on exact head, run canonical + protected Vercel Preview with owner approval. User will verify safe prerelease message and signout. **Personal data writing stays gated** until separate consent, device/old-PWA and writer-fence/release approval. Preserve Brevo rollback, immutable R2 BEFORE/AFTER, old Appwrite data and local drafts.

Issue and full evidence: https://github.com/carlers/mosaic-life-tracker/issues/1027
