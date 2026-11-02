# Build capabilities and personal single-user mode (#1026)

## Immutable ceiling and preference

The typed build capability manifest is in src/lib/capabilityProfile.ts. The
normal Appwrite build is full. Set VITE_MOSAIC_CAPABILITY_PROFILE=core-only to
keep tasks, calendar, categories, Backlogs, Diary, Bucket List, account and
personal sync while suppressing social feature families. Unknown nonempty
profile values also fail closed for social. A remote PostHog flag or user
preference cannot enable unsupported build capabilities or change permissions.

Personal single-user mode appears in Preferences > Privacy & Social. The choice
is owner-scoped in the existing syncable Settings collection and mirrored in
local storage for instant/offline access. Existing friendships, message rows,
queued operations, cursors and other user data are preserved.

## Social background behavior

Disabling social stops friendship and message replication pilots, including
their realtime subscriptions, and excludes their collections from fresh
sync and reconciliation. Core groups retain their existing sync behavior.
New outbound message delivery, social outbox flushing and push re-registration
are suppressed. Enabling social resumes normal owner-scoped replication.

This is NOT a server permission or privacy boundary. Existing push endpoints,
in-flight operations and Appwrite ACLs are unaffected by a client-only change.
Task replication can include shared tasks in the core task collection. A
proper server-enforced private mode requires a separate provider/backend
contract and acceptance.

## Developer diagnostics

Build with VITE_MOSAIC_OPERATOR_DIAGNOSTICS=true to display read-only,
searchable effective remote flag status and build profile in Privacy & Social.
Development builds show diagnostics automatically. Do not expose PostHog
management credentials to the client. Leave this control off in Production.

## Device acceptance

On an isolated Scratch account, test desktop and Android PWA online/offline
cold starts, PostHog unavailable and stale caches. Flip Personal single-user
mode on and off; verify Home, tasks, calendars, categories, Backlogs, Diary
and Bucket List remain usable, including unsynced personal edits. Test direct
social deep links, swipe and browser Back. Check that friend/message pilots,
realtime listeners, outbound queues and push re-enrollment cease when disabled.
Re-enable and verify retained rows and exact cursors resume without duplicates.
Switch between accounts and devices to verify owner isolation.

Already enrolled OS push subscriptions need explicit online server-side
verification; do not treat a hidden UI as proof of server-side unsubscribe.
Do not promote to dev, main or Production without the required approvals.
