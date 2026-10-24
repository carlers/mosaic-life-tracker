# One-command full existing Supabase recovery and photo-security drill (#1027)

**Purpose:** prove the repeated operator steps from October 24 can be
executed in **one** trusted Fedora terminal invocation. Unlike
`operator-onepass.py --rehearse`, this is an actual **hosted Scratch encrypted database AND complete private Storage bucket backup,
disposable real-data and binary media restore, signed Auth/privacy, and synthetic photo security test**. It deliberately does not include unreviewed
Production writes or full managed-platform disaster recovery.

Entrypoint: `supabase-poc/full-recovery-drill.py`, always pinned to the
reviewed source SHA in the isolated Supabase branch.

## Single operator command for live acceptance

Run from a **trusted interactive Fedora shell**, not GitHub Actions or a
cloud runner. This command fetches source once, pins the exact SHA, and runs
the reviewed orchestrator. It creates a uniquely named detached **temporary
worktree**, leaving all existing worktrees/dirty edits alone.

```bash
bash -o pipefail -c 'repo="$HOME/mosaic-photo-dr-review/life-tracker"; git -C "$repo" fetch --quiet origin feature/1027-supabase-recovery-20261020 && sha="$(git -C "$repo" rev-parse FETCH_HEAD)" && git -C "$repo" show "$sha:life-tracker/supabase-poc/full-recovery-drill.py" | python3 - --run --source-sha "$sha"'
```

All **input prompts remain inside that same run**: the Scratch database password, one existing populated account's original password (for the local restored GoTrue test), two distinct hosted test-account logins, and **one backend-only Scratch Storage key** for a read-only complete private bucket capture. Never give a privileged Storage key to frontend code or paste it into chat. Never paste passwords, API keys, owner UUIDs or
record data to ChatGPT. The operator's existing **IPv4 Session pooler
configuration** `~/.config/mosaic/supabase-pooler.env`, the old private
`~/.config/mosaic/supabase-backup.agekey` and private backup directory are
reused; no reconfiguration or archive hunting. No new service-role key is
needed to run the historical signed synthetic photo gates.

The orchestrator executes all of these fail-closed stages in order:

1. Verify source exact Git SHA, local Fedora private resource permissions,
   current project's **saved** IPv4 pooler identity and required binaries.
2. Create fresh `age`-encrypted complete PostgreSQL dump, authenticate the
   complete ciphertext and inspect required Auth/core TOC entries.
3. Pin the ciphertext SHA-256 and independently restore the seven allowlisted
   Auth/core/Diary data tables to a **new loopback-only local PG17 Supabase
   stack**, verifying exact source/target rows and excluding stale sessions.
4. Original-password sign-in against that fresh GoTrue, owner authority/lease,
   positive live task/category read, and cross-owner denial.
5. Real hosted two-account, owner/foreign/anonymous WebP Storage checks;
   encrypt the synthetic image with the existing age key, decrypt and restore
   its exact bytes into a second synthetic hosted object, verify it and delete
   **both** isolated objects with signed list-based absence checks.
6. Capture every user-private WebP in the hosted Scratch bucket with the read-only
   backend-only Storage key into a streaming `age` encrypted tar/manifest.
   Verify the full ciphertext, owner folder paths, file sizes and per-object
   SHA-256 values **before any restore**. Restore ALL captured objects into
   the same new independent **loopback-only** local Supabase Storage project
   and compare each downloaded byte and the local object count. Never upload
   recovered bytes to the hosted source. If hosted Storage contains zero
   objects, independently encrypt and restore a nonempty synthetic WebP
   archive on the disposable local Storage target; report the source as
   empty rather than pretending real user photos were recovered.
7. Stop **only the new private local Supabase project**, remove **only the new
   private Docker bridge** and delete its uniquely generated temporary
   recovery directory/worktree. Retain the fresh encrypted snapshot and
   synthetic age ciphertext outside the repository as recovery evidence.

The final success marker is
`MOSAIC_FULL_DR_COMBINED_EXISTING_GATES_PASS`. A failure stops later stages,
reports `MOSAIC_FULL_DR_NOT_VERIFIED` and still attempts exact-scope cleanup.
A partial stage's PASS does not count as complete acceptance. Credentials
are not written to repo files, passed on the command line, printed by the
orchestrator, or retained in GitHub CI.

## 2026-10-24 preflight compatibility repair

The first live one-command Fedora execution returned only
`MOSAIC_FULL_DR_NOT_VERIFIED`, without entering any stage or prompting
for passwords. The preflight incorrectly looked for `.git` **inside**
`life-tracker/`, whereas Mosaic's Git root/linked-worktree `.git`
is correctly in its parent directory. The runner now validates the
nested repo through real `git rev-parse --show-toplevel` and FETCH_HEAD
source pin, with a regression using an actual nested scratch Git repo
and detached worktree. No fresh snapshot or hosted user data writes
were observed from that failed preflight.

A future fail-closed run now prints **`MOSAIC_FULL_DR_FAILED_STAGE`**
with a safe program-authored reason, then
`MOSAIC_FULL_DR_NOT_VERIFIED`. These are diagnostics, not success.
Once canonical CI passes the repair, rerun only the single exact
fetch+source-pinned orchestration command above; do **not** repeat
individual database, pooler, age key, account or Storage micro-commands.

## Automated CI rehearsal (does NOT require Fedora secrets)

The no-network Python test under
`supabase-poc/tests/test_full_recovery_drill.py` replaces all privileged
subprocesses with bounded fake implementations and verifies that **one
invocation** reaches database snapshot, TOC, restore, signed account,
hosted photo, full Storage snapshot, independent Storage restore, and teardown;
incorrect pooler identities/TOC are denied and a photo failure still stops
the drill and cleans the generated target. An offline `--plan` prints the
stage contract. The repository's Vitest unit suite invokes both tests.

The CI rehearsal establishes orchestration, path fencing and failure
behavior but **does not substitute for a subsequent one-run Fedora
acceptance** or for a screenshot/device/manual session.

## Limits and backend portability

The drill extends the existing verified Supabase Scratch gates with a
**new full-bucket isolated-Storage restore stage**, which requires its own
real Fedora execution before it can be called accepted. The current hosted
source bucket is empty; the synthetic encrypted nonempty recovery test proves
the binary pipeline, **not recovery of actual user media that do not exist yet**.
The drill intentionally exercises a bounded isolated Scratch scope; it is not a full production readiness certificate.
Unproven work remains: managed Auth/SMTP settings recovery, a protected **scheduled/offsite** whole-bucket encrypted Storage backup and retention policy, and recovery of a **nonempty real** user-media bucket once it exists, a different provider's mapping and old-writer fence,
mobile/offline/ZIP manual acceptance, the missing private Bucket List/settings
Supabase parity, and the separately protected Preview/dev/main/Production
approvals.

Future Appwrite↔Supabase provider migration runners should reuse the
general sequence (source preflight → encrypted snapshot → digest/manifest →
disposable target → signed owner/foreign denial → binary media restore →
bounded cleanup → separately approved cutover), but must implement
provider-specific adapters and exact owner mapping. The existence of this
Supabase drill does **not** prove provider-to-provider reversible migration
or warrant a one-command production cutover.
