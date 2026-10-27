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

## Six-domain application lifecycle

The `personal` feature profile selects the six-domain bootstrap from the existing
Auth coordinator. Tasks, categories, Diary, portable Settings, Bucket List and
links share signed session checks, one provider lease, shutdown before refresh or
logout, conflict review, and full six-group Sync Now verification. Review work is
drained before releasing the lease. Missing server Bucket/task targets leave a
local link pending for retry; local IDs alone are never ownership proof.

Startup additionally calls the signed `mosaic_personal_readiness` RPC. The private
installation's `personal_release_evidence` defaults to null; installing migrations
or choosing a browser profile cannot approve readiness. A protected rollout must
record reviewed schema-14 restore and signed-lab run IDs and their source SHA only
after the corresponding hosted schema/security/backup gates pass. The disposable
CI fixture uses a synthetic marker solely inside its local stack. The marker and
Realtime additions are preserved by the fourteen-table restore profile.

This first integrated path accepts only server-enrolled independent new data with
fresh or recovery-pending consent. A recovered/linked principal is deliberately
refused until verified historical linking and escrow are implemented. Suspended
Appwrite history is not fenced or imported by this adapter.

Portable settings use their separate RxDB collection. Existing device values are
a read fallback until a portable value arrives; a portable tombstone suppresses
that fallback. Profile images and social carousel preferences stay local. ZIP
Merge now routes the six supported domains and filters nonportable settings; it
does not claim account linking or complete historical recovery. Replace remains
blocked on Supabase. Export includes current portable preferences. Existing ZIP
active-row exports do not yet constitute a complete tombstone/history escrow.

The isolated artifact builder now produces the `personal` profile; its staging
verifier requires that exact profile and retains the fixed Preview-only project,
source SHA and backend checks. No hosted readiness marker or deployment is changed
by building an artifact. Protected Preview must wait for the hosted prerequisites.
