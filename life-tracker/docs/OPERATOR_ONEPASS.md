# Mosaic operator one-pass commands (#1027)

**Default**: the assistant completes all safe connected GitHub, Supabase, Vercel
and CI steps without sending the operator to a terminal. If trusted machine
access, non-exportable credentials, or physical/device testing is necessary,
provide **one pasteable shell command per handoff**, at most **two**. That command
must preflight identity/source, do all authorized checks, clean up temporary
resources, and print only fixed sanitized PASS or failure markers. Do not
artificially split one workflow into an escalating series of manual requests.
Do not tell the operator to reuse stale or unknown credentials; make
secret prompts interactive and never include service keys/JWTs in a command,
repository, chat, Actions logs or a browser bundle.

**No action currently needed for the 2026-10-24 hosted photo cleanup.**
The original extra test photo was removed via the authenticated Storage API
(HTTP 200), with a later independent hosted inventory confirming **zero**
objects. The signed two-account photo RLS/immutable/private negative tests
and encrypted synthetic binary round-trip passed; the cleanup runner's old
final marker was misleading. The age-encrypted fresh PostgreSQL backup
independently restored **410 exact rows across seven tables**, and fresh
password sign-in/owner privacy checks passed. Don't ask the owner to repeat
these completed proofs or reconfigure the saved Fedora pooler.

## Tested one-command offline rehearsal

The reviewed source entrypoint is
[supabase-poc/operator-onepass.py](../supabase-poc/operator-onepass.py).
CI executes its no-secret/no-network real control path, using a synthetic
temporary home, local age identity and simulated child snapshot to prove
private-key environment isolation, a single guarded downstream call,
file permission checks, and denial of a publishable (non-admin) key.
It additionally tests that Git source is an **exact SHA** and belongs to
the pinned Scratch Storage identity. **This is an offline simulation, not
a test performed on the owner's Fedora or a live cloud backup.**

For an optional *local reproduction*, one pasted command:

\`\`\`bash
repo="$HOME/mosaic-photo-dr-review/life-tracker"; \
git -C "$repo" fetch --quiet origin feature/1027-supabase-recovery-20261020 && \
git -C "$repo" show FETCH_HEAD:life-tracker/supabase-poc/operator-onepass.py | python3 - --rehearse
\`\`\`

Expected: \`MOSAIC_ONEPASS_OFFLINE_REHEARSAL_PASS\`,
\`MOSAIC_ONEPASS_MAX_TWO_COMMANDS_PASS\`, and
\`MOSAIC_ONEPASS_NO_NETWORK_OR_CLOUD_WRITES_PASS\`. It makes **zero**
remote requests or mutations after the Git source fetch and asks for no
passwords. The assistant already performs the same offline rehearsal in CI,
so do not require the user to rerun it merely to prove that it works.

## Future one-command full-bucket encrypted capture

This is *future work when a protected backend-only key is provisioned*,
not an instruction to run today. The runner intentionally does not
attempt to access a privileged key through management tools or silently
provision one. It prompts privately **once**, passes that credential only
to the existing bounded, read-only, project-pinned
\`supabase-poc/private-photo-snapshot.py\`, and reuses the existing
0600 age identity and 0700 encrypted-backup directory:

\`\`\`bash
repo="$HOME/mosaic-photo-dr-review/life-tracker"; \
git -C "$repo" fetch --quiet origin feature/1027-supabase-recovery-20261020 && \
git -C "$repo" show FETCH_HEAD:life-tracker/supabase-poc/operator-onepass.py | \
python3 - --media-snapshot --source-sha "$(git -C "$repo" rev-parse FETCH_HEAD)"
\`\`\`

It refuses a missing/invalid source SHA, wrong backend Storage source,
world-readable escrow, public-only API key, a failed decryption/checksum
or archive collision. It never calls remote SQL, Storage DELETE, Auth admin,
Vercel deploy or provider promotion. On success the underlying implementation
prints \`SUPABASE_PRIVATE_MEDIA_ENCRYPTED_SNAPSHOT_PASS\`, then the wrapper
prints \`MOSAIC_ONEPASS_PRIVATE_MEDIA_SNAPSHOT_COMPLETE\`. If the bucket
currently contains **zero objects**, the result certifies only an empty
inventory, NOT future media recoverability.

Still required before enabling hosted personal photos broadly:
protected recurring **full-bucket** backups/retention and alerts, an
independent *nonempty* media restore to a distinct authorized target,
managed Auth/configuration safeguards, mobile/offline/ZIP acceptance, and
the separately protected Preview approval. Neither the single synthetic
photo round-trip nor this one-pass snapshot source replaces those gates.

## Agent handoff contract

1. Search/verify live repository branch + exact CI/hosted inventory first.
2. Execute any safe connector work fully and resolve routine failures.
3. If local action is truly unavoidable, batch it into **one** scoped,
   safely resumable command (two only when unavoidable) with hidden prompts,
   explicit success/failure boundaries and no repeat of already proven stages.
4. Wait for the user's result only where private local credentials or
   physical-device validation are inaccessible. Don't use ordinary
   operator workload as an excuse for unperformed connected-tool work.
5. Keep Preview reviewer approval, dev/main promotions, and Production
   writes separately gated by the repo's release policy. Even a one-command
   operator must *not* silently bypass approvals, RLS or disaster recovery.
