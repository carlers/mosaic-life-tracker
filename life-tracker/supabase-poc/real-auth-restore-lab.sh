#!/usr/bin/env bash
# #1027 generated-data local GoTrue recovery; never accepts hosted credentials.
set -euo pipefail
test "$GITHUB_ACTIONS" = true
test "$MOSAIC_REAL_AUTH_RECOVERY_LAB" = 1
unset PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD PGSERVICE PGOPTIONS
if printenv SUPABASE_ACCESS_TOKEN >/dev/null || printenv DATABASE_URL >/dev/null; then
  echo 'Unexpected hosted connection environment' >&2; exit 2
fi
root="$(cd "$(dirname "$0")/.." && pwd -P)"
tmp="$(mktemp -d "$RUNNER_TEMP/mosaic-auth-restore.XXXXXXXX")"
chmod 700 "$tmp"
trap 'supabase stop --no-backup >/dev/null 2>&1 || true; rm -rf -- "$tmp"' EXIT
supabase init --yes >/dev/null
mkdir -p supabase/migrations
n=0
for name in 20261018_candidate_task_category_owner_schema \
  20261018_candidate_revoke_default_delete \
  20261019_candidate_atomic_cas_rpc 20261020_candidate_task_protected_fields \
  20261020_core_fresh_identity_authority 20261021_core_realtime_publication; do
  printf -v stamp '2026102000%04d' "$n"
  cp "$root/supabase-poc/migrations/$name.sql" "supabase/migrations/$stamp"_"$name.sql"
  n=$((n+1))
done
python3 - <<'PY'
from pathlib import Path
import re
p = Path('supabase/config.toml')
lines = p.read_text().splitlines(keepends=True)
is_email = False
is_db = False
found = 0
found_pg17 = 0
for i, line in enumerate(lines):
  if line.strip().startswith('[') and line.strip().endswith(']'):
    is_email = line.strip() == '[auth.email]'
    is_db = line.strip() == '[db]'
  elif is_email and re.fullmatch(r'\s*enable_confirmations\s*=\s*(true|false)\s*', line):
    lines[i] = 'enable_confirmations = false\n'
    found += 1
  elif is_db and re.fullmatch(r'\s*major_version\s*=\s*\d+\s*', line):
    lines[i] = 'major_version = 17\n'
    found_pg17 += 1
if found != 1 or found_pg17 != 1:
  raise SystemExit('Expected one local email confirmation and PG17 setting')
p.write_text(''.join(lines))
PY
supabase start --exclude realtime,storage,functions,studio,mail,analytics,pooler >/dev/null
supabase db reset --local >/dev/null
get_db() {
  ids="$(docker ps --filter name=supabase_db_ --format '{{.ID}}')"
  test "$(printf '%s\n' "$ids" | wc -l)" -eq 1
  test -n "$ids"
  printf '%s\n' "$ids"
}
db="$(get_db)"
supabase status -o env >"$tmp/supabase.env"
set -a
source "$tmp/supabase.env"
set +a
export MOSAIC_AUTH_LAB_URL=http://127.0.0.1:54321
export MOSAIC_AUTH_LAB_PUBLISHABLE_KEY="$PUBLISHABLE_KEY"
export MOSAIC_AUTH_LAB_FIXTURE="$RUNNER_TEMP/mosaic-auth-recovery-fixture.json"
test -n "$MOSAIC_AUTH_LAB_PUBLISHABLE_KEY"
rm -f "$MOSAIC_AUTH_LAB_FIXTURE"
trap 'supabase stop --no-backup >/dev/null 2>&1 || true; rm -f "$MOSAIC_AUTH_LAB_FIXTURE"; rm -rf -- "$tmp"' EXIT
node "$root/supabase-poc/tests/real-auth-restore-local.mjs" seed
docker exec "$db" pg_dump --no-owner -U postgres -d postgres -Fc >"$tmp/source.dump"
age-keygen -o "$tmp/key" >"$tmp/key.log" 2>&1
age -r "$(age-keygen -y "$tmp/key")" "$tmp/source.dump" >"$tmp/backup.age"
age -d -i "$tmp/key" "$tmp/backup.age" >"$tmp/recovered.dump"
cmp -s "$tmp/source.dump" "$tmp/recovered.dump"
# Both disposable restore paths use exactly this one authenticated archive.
# Six-table CI cannot use the fresh-snapshot switch: it would require Diary.
synthetic_sha="$(sha256sum "$tmp/backup.age" | cut -d' ' -f1)"
[[ "$synthetic_sha" =~ ^[a-f0-9]{64}$ ]] || exit 1
export MOSAIC_SYNTHETIC_ARCHIVE_SHA256="$synthetic_sha"
docker cp "$tmp/recovered.dump" "$db:/tmp/mosaic-auth-recovery.dump"
docker exec "$db" pg_restore --list /tmp/mosaic-auth-recovery.dump |
 node "$root/supabase-poc/inspect-archive-toc.mjs" >"$tmp/metadata.json"
docker exec "$db" rm -f /tmp/mosaic-auth-recovery.dump
# Reset the whole disposable local stack; do not replay managed definitions.
supabase db reset --local >/dev/null
db="$(get_db)"
# Exercise the exact operator six-table restore engine with fake GoTrue data.
python3 "$root/supabase-poc/restore_private_core_to_disposable.py" \
  "$tmp/backup.age" "$tmp/key" "$db"
node "$root/supabase-poc/tests/real-auth-restore-local.mjs" verify
echo 'REAL_GOTRUE_LOCAL_RESTORE_PASS: password, owner, revisions, denied prior session and signed foreign access'

# Exercise the independent new-stack operator wrapper as a second, real GoTrue
# generated-data test. First stop this first lab's CLI instance, without
# touching any external project, to free runner resources.
supabase stop --no-backup >/dev/null
wrapper_out="$(bash "$root/supabase-poc/run-private-core-recovery.sh" "$tmp/backup.age" "$tmp/key")"
printf '%s\n' "$wrapper_out" | grep -q 'DISPOSABLE_CORE_RESTORE_PASS'
printf '%s\n' "$wrapper_out" | grep -q 'ISOLATED_LOCAL_STACK_READY: mosaic_dr_'
new_lab="$(printf '%s\n' "$wrapper_out" | sed -n 's/^PRIVATE_LOCAL_DIRECTORY: //p')"
case "$new_lab" in
  "$HOME"/.mosaic-private-recovery-*) ;;
  *) echo 'Unrecognized new-stack project directory' >&2; exit 1 ;;
esac
test -f "$new_lab/supabase/config.toml"
(cd "$new_lab" && supabase stop --no-backup >/dev/null)
echo 'INDEPENDENT_GO_TRUE_RECOVERY_STACK_PASS: generated snapshot restored to separate local project'
