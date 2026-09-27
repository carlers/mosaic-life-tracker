# Session checkpoint

Updated: 2026-09-27

Current task: prepare Mosaic's provider-independent disaster-recovery backup workstream before implementation.

Status: planning/preparation complete on `chatgpt/disaster-backups`, targeting stable Preview `security/disaster-backups`. The stable branch was created directly from merged `dev` commit `800bc4cbd01e6a68c14d46a7a05dff16c229c9c5`. No disaster-backup runtime code or Appwrite/Cloudflare configuration has been changed yet.

## Working set
- `docs/PLAN.md`: durable DR roadmap and two-Appwrite-Function capacity architecture
- forthcoming dedicated Appwrite disaster-backup Function
- forthcoming admin restore/verification CLI
- forthcoming non-secret Appwrite infrastructure/resource definitions and environment-configurable identifiers
- handler/unit coverage for backup format, encryption/integrity, retention, discovery, and restore verification

## Prepared architecture
- Function slot 1 remains the existing `message-action` implementation for now and is planned to evolve into the general trusted `app-api` surface. Future Strava/Spotify/Garmin/Hevy/Letterboxd/YouTube integrations are modules/routes/webhooks within that Function rather than separate Appwrite Functions.
- Function slot 2 is reserved for a dedicated privileged `dr-backup` Function. Do not merge its broad read-only backup privileges into the normal trusted app API.
- Disaster snapshots cover the recoverable backend, not only the client-synced tables: Auth user metadata/password hashes where supported, dynamically discovered TablesDB resources/permissions/rows, Storage configuration/files/permissions/bytes, and repository-owned infrastructure/function definitions.
- Snapshot format is versioned, compressed, independently authenticated-encrypted, integrity-verified, and commit-marked. Storage blobs are content-addressed/deduplicated.
- Restore is an explicit admin CLI into a separate target project. Production scheduling is blocked until an isolated restore drill verifies IDs, schemas, rows, permissions, files, and login/application behavior.
- Backup encryption keys and R2 recovery credentials must be escrowed outside Appwrite so an Appwrite-loss event does not destroy the recovery path.
- User-facing Backup & Restore remains separate from disaster recovery.

## Constraints
- Preserve the two-function Free-plan architecture: one general trusted app API Function plus one isolated DR Function.
- Apply least privilege. The DR Function is read-only against Appwrite source data; restore write credentials belong only to the separate admin restore path.
- Do not log user content, secrets, password hashes, file bytes, or decrypted backup payloads.
- Do not hardcode today's table list into the exporter. Resource discovery must protect future backend additions.
- Do not enable a production backup schedule until an isolated restore drill passes.
- Do not promote `security/disaster-backups` to `dev` without explicit user instruction.

## Verification
- Baseline: `dev` commit `800bc4cbd01e6a68c14d46a7a05dff16c229c9c5` (offline-startup work already merged and accepted before this task).
- This preparation changes documentation only; repository docs-mode CI is the applicable verification.
- No live Appwrite/R2 changes have been made, so no deployment or restore verification is claimed yet.

Next action: implement the DR specification/tests and dedicated backup Function on `chatgpt/disaster-backups`, then build the admin restore CLI, perform canonical acceptance, squash-deliver to `security/disaster-backups`, configure an isolated DR test project/R2 target, and complete the restore drill before enabling production scheduling.

Blockers: none.
