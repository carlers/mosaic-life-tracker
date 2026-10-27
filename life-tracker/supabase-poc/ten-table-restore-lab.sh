#!/usr/bin/env bash
# Disposable GH only. Encrypt actual synthetic ten-table PG17 and independently
# restore into new local stack, then signed GoTrue reauthentication / RLS.
set -euo pipefail
umask 077
test "$GITHUB_ACTIONS" = true
test "$MOSAIC_REAL_AUTH_RECOVERY_LAB" = 1
test "$RUNNER_TEMP" = /home/runner/work/_temp
for name in PGHOST PGUSER PGPASSWORD DATABASE_URL SUPABASE_ACCESS_TOKEN AWS_SECRET_ACCESS_KEY; do
  if printenv "$name" >/dev/null; then
    echo 'Refusing inherited hosted/provider credentials' >&2; exit 2
  fi
done
for cmd in docker supabase age age-keygen python3 node sha256sum; do
  command -v "$cmd" >/dev/null || exit 2
done
here="$(cd "$(dirname "$0")" && pwd -P)"
tmp="$(mktemp -d "$RUNNER_TEMP/mosaic-ten-buckets.XXXXXXXX")"
chmod 700 "$tmp"
target=""
network=""
cleanup() {
  set +e
  if [[ "$target" =~ ^/home/runner/\.mosaic-private-recovery-[A-Za-z0-9]{8}$ && -f "$target/supabase/config.toml" ]]; then
    (cd "$target" && supabase stop --no-backup >/dev/null 2>&1) || :
    rm -rf -- "$target"
  fi
  if [[ "$network" =~ ^mosaic_dr_net_[a-f0-9]{12}$ ]]; then
    docker network rm "$network" >/dev/null 2>&1 || :
  fi
  if test -f "$tmp/source/supabase/config.toml"; then
    (cd "$tmp/source" && supabase stop --no-backup >/dev/null 2>&1) || :
  fi
  rm -rf -- "$tmp"
}
trap cleanup EXIT
mkdir -p "$tmp/source"
cd "$tmp/source"
supabase init --yes >/dev/null
mkdir -p supabase/migrations
i=0
for migration in \
  20261018_candidate_task_category_owner_schema \
  20261018_candidate_revoke_default_delete \
  20261019_candidate_atomic_cas_rpc \
  20261020_candidate_task_protected_fields \
  20261020_core_fresh_identity_authority \
  20261021_core_realtime_publication \
  20261022_candidate_private_diary_domain \
  20261025_candidate_private_personal_settings \
  20261025_candidate_private_bucket_links; do
  printf -v stamp '2026102000%04d' "$i"
  cp "$here/migrations/$migration.sql" "supabase/migrations/$stamp"_"$migration.sql"
  i=$((i+1))
done
if [[ ${MOSAIC_ACCOUNT_REGISTRY_LAB:-} == 1 ]]; then
  cp "$here/migrations/20261027170802_mosaic_account_registry.sql" supabase/migrations/20261027170802_mosaic_account_registry.sql
  cp "$here/migrations/20261027172600_personal_runtime_readiness.sql" supabase/migrations/20261027172600_personal_runtime_readiness.sql
  cp "$here/migrations/20261027182613_require_complete_personal_release_evidence.sql" supabase/migrations/20261027182613_require_complete_personal_release_evidence.sql
  cp "$here/migrations/20261027183840_enforce_personal_writer_consent.sql" supabase/migrations/20261027183840_enforce_personal_writer_consent.sql
fi
python3 - <<'PY'
from pathlib import Path
import re
p=Path('supabase/config.toml')
lines=p.read_text().splitlines(keepends=True)
section=''
email=pg=0
for i,line in enumerate(lines):
    if line.strip().startswith('[') and line.strip().endswith(']'):
        section=line.strip()
    elif section=='[auth.email]' and re.fullmatch(r'\s*enable_confirmations\s*=\s*(true|false)\s*',line):
        lines[i]='enable_confirmations = false\n';email+=1
    elif section=='[db]' and re.fullmatch(r'\s*major_version\s*=\s*\d+\s*',line):
        lines[i]='major_version = 17\n';pg+=1
if email!=1 or pg!=1:
    raise SystemExit('Refusing unexpected local config format')
p.write_text(''.join(lines))
PY
supabase start --exclude realtime,storage,functions,studio,mail,analytics,pooler >/dev/null
supabase db reset --local >/dev/null
db="$(docker ps --filter name=supabase_db_ --format '{{.ID}}')"
[[ -n "$db" && "$db" != *$'\n'* ]] || exit 1
docker exec "$db" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$here/validation/20261025_private_settings_contract.sql" >/dev/null
docker exec "$db" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$here/validation/20261025_private_bucket_links_contract.sql" >/dev/null
if [[ ${MOSAIC_ACCOUNT_REGISTRY_LAB:-} == 1 ]]; then
  # Synthetic local marker, never a hosted release approval.
  docker exec -i "$db" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
  update mosaic_candidate_private.identity_installation set personal_release_evidence=
    '{"schema":14,"sourceSha":"0000000000000000000000000000000000000000","signedRun":100,"restoreRun":100}';
SQL
fi
supabase status -o env > "$tmp/source.env"
set -a
source "$tmp/source.env"
set +a
test -n "$PUBLISHABLE_KEY"
export MOSAIC_SB_LOCAL_URL=http://127.0.0.1:54321
export MOSAIC_SB_LOCAL_PUBLISHABLE_KEY="$PUBLISHABLE_KEY"
node "$here/tests/personal-settings-signed-local.mjs" > "$tmp/signed-source-report"
node "$here/tests/personal-bucket-links-signed-local.mjs" > "$tmp/bucket-signed-source-report"
export MOSAIC_SETTINGS_RESTORE_URL=http://127.0.0.1:54321
export MOSAIC_SETTINGS_RESTORE_KEY="$PUBLISHABLE_KEY"
export MOSAIC_SETTINGS_RESTORE_FIXTURE="$tmp/synthetic-owner.json"
export MOSAIC_BUCKET_RESTORE_FIXTURE="$tmp/synthetic-bucket-owner.json"
node "$here/tests/eight-table-restore-fixture.mjs" seed
node "$here/tests/ten-table-restore-fixture.mjs" seed
docker exec "$db" pg_dump --no-owner -Fc -U postgres -d postgres > "$tmp/only-synthetic.dump"
age-keygen -o "$tmp/identity.agekey" >/dev/null 2>&1
age -r "$(age-keygen -y "$tmp/identity.agekey")" "$tmp/only-synthetic.dump" > "$tmp/archive.age"
age -d -i "$tmp/identity.agekey" "$tmp/archive.age" >/dev/null
sha="$(sha256sum "$tmp/archive.age" | cut -d' ' -f1)"
[[ "$sha" =~ ^[a-f0-9]{64}$ ]] || exit 1
echo MOSAIC_BUCKET_TEN_TABLE_ENCRYPTED_SOURCE_PASS
# The age archive was created by PostgreSQL 17 in the disposable source
# container. ubuntu-24.04's host pg_restore may be PostgreSQL 16 and refuses
# v1.16 custom archives, falsely marking an intact age backup as unreadable.
# Run the *existing* full-byte-age+TOC inspector unchanged, with its pg_restore
# command bound to the SAME PG17 client that created this synthetic archive.
docker exec "$db" pg_restore --version | grep -Eq '^pg_restore \(PostgreSQL\) 17\.'
mkdir -m 700 "$tmp/pg17-tools"
cat > "$tmp/pg17-tools/pg_restore" <<'PG17_READER'
#!/usr/bin/env bash
set -euo pipefail
[[ "${MOSAIC_TEN_BUCKETS_PG17_CONTAINER:-}" =~ ^[a-f0-9]{12,64}$ ]] || {
  echo 'Missing exact disposable PostgreSQL 17 container identity' >&2
  exit 2
}
exec docker exec -i "$MOSAIC_TEN_BUCKETS_PG17_CONTAINER" pg_restore "$@"
PG17_READER
chmod 700 "$tmp/pg17-tools/pg_restore"
# No plaintext disk copy, no hosted PostgreSQL access, no weakened TOC/profile.
# Both age decrypts still stream through the same existing inspector.
MOSAIC_TEN_BUCKETS_PG17_CONTAINER="$db" PATH="$tmp/pg17-tools:$PATH" \
  bash "$here/inspect-encrypted-backup-toc.sh" "$tmp/archive.age" "$tmp/identity.agekey" |
  node "$here/tests/inspect-ten-table-profile-ci.mjs"
echo MOSAIC_BUCKET_TEN_TABLE_TOC_PROFILE_PASS
supabase stop --no-backup >/dev/null
unset MOSAIC_SB_LOCAL_URL MOSAIC_SB_LOCAL_PUBLISHABLE_KEY
unset MOSAIC_SETTINGS_RESTORE_URL MOSAIC_SETTINGS_RESTORE_KEY
restore_mode=--fresh-personal-bucket-links-sha256
if [[ ${MOSAIC_ACCOUNT_REGISTRY_LAB:-} == 1 ]]; then restore_mode=--fresh-personal-identity-sha256; fi
report="$(bash "$here/run-private-core-recovery.sh" "$tmp/archive.age" "$tmp/identity.agekey" "$restore_mode" "$sha")"
target="$(sed -n 's/^PRIVATE_LOCAL_DIRECTORY: //p' <<< "$report")"
network="$(sed -n 's/^PRIVATE_DOCKER_NETWORK: //p' <<< "$report")"
url="$(sed -n 's/^LOCAL_AUTH_API: //p' <<< "$report")"
[[ "$target" =~ ^/home/runner/\.mosaic-private-recovery-[A-Za-z0-9]{8}$ ]] || exit 1
[[ "$network" =~ ^mosaic_dr_net_[a-f0-9]{12}$ ]] || exit 1
[[ "$url" =~ ^http://127\.0\.0\.1:(3[2-9][0-9]{3}|4[0-6][0-9]{3}|47000)$ ]] || exit 1
if [[ ${MOSAIC_ACCOUNT_REGISTRY_LAB:-} == 1 ]]; then
  grep -Fq 'DISPOSABLE_CORE_RESTORE_PASS: 14 data tables' <<< "$report"
else
  grep -Fq 'DISPOSABLE_CORE_RESTORE_PASS: 10 data tables' <<< "$report"
fi
grep -Fq 'exact source/target rows verified' <<< "$report"
echo MOSAIC_BUCKET_TEN_TABLE_EXACT_COPY_RESTORE_PASS
(cd "$target" && supabase status -o env) > "$tmp/target.env"
set -a
source "$tmp/target.env"
set +a
test -n "$PUBLISHABLE_KEY"
export MOSAIC_SETTINGS_RESTORE_URL="$url"
export MOSAIC_SETTINGS_RESTORE_KEY="$PUBLISHABLE_KEY"
node "$here/tests/eight-table-restore-fixture.mjs" verify
node "$here/tests/ten-table-restore-fixture.mjs" verify
echo MOSAIC_BUCKET_TEN_TABLE_REAL_SIGNED_RESTORE_PASS
