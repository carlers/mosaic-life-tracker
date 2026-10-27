# Mosaic account identity and recovery state

The isolated v0.48.0 candidate adds the private versioned identity registry for
#1406. It preserves the existing server-issued canonical Mosaic ID (the `sb_`
identifier is a stable application ID, not an assumption that provider IDs match).
The installation UUID, provider, native user ID, verification provenance, claim
state, version and audit events are private, with no browser table grants.
The signed self-only RPC checks the live Auth session and existing core authority.
Neither email, password, user metadata nor a ZIP's claimed owner can authorize a link.

Before the application starts a writer, a new/unconfirmed account chooses either
fresh data or new data with historical recovery pending. Consent is stored on the
server and survives devices/reloads. Pending cannot be downgraded to fresh, and
clients cannot mark history recovered. New Supabase records remain separate from
historical Appwrite records. The app asks users to retain old app caches and backups.
No historical row, media reference, owner ID or tombstone is rewritten by enrollment.

This does **not** yet implement verified historical claiming/import. A trusted
owner-escrow or provider-session association requires separately reviewed evidence
and an audited reconciliation flow; there is deliberately no public linking RPC.
No complete-migration claim or Appwrite old-writer-fence claim follows from new-data
consent. #1407 governs later reconciliation against the current authority.

## Recovery and deployment boundary

The four registry tables require the explicit `fourteen-personal-identity` backup
profile and `--fresh-personal-identity-sha256` disposable restore mode. Older
profiles reject a registry-bearing archive. The restore preserves exact source
COPY rows, installation ID, consent, mappings and audit events, resets the audit
sequence, and never restores sessions, refresh tokens or writer leases. The
existing encrypted private-data lab now exercises this extension with actual
GoTrue reauthentication. Its exact CI result is required; local unit tests alone
do not establish signed recovery.

Do not deploy new application bytes against the old hosted schema: the registry
RPC is required and missing schema fails closed. Hosted additive migration,
security/advisor review, registry-bearing encrypted backup/restore and protected
Preview acceptance remain required before promotion. No Production target or
authority change is performed by this source change. Earlier accepted immutable
backup evidence remains valid for its original schema only.

Settings and Bucket mutations additionally recheck the active local account after
asynchronous reads, including duplicate-insert recovery and relationship cleanup.
Previously dispatched writes can finish; no new mutation is dispatched after an
observed account change. Ambiguous/colliding Settings IDs never rewrite ownership.
