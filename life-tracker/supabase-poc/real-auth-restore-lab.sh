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
found = 0
for i, line in enumerate(lines):
  if line.strip().startswith('[') and line.strip().endswith(']'):
    is_email = line.strip() == '[auth.email]'
  elif is_email and re.fullmatch(r'\s*enable_confirmations\s*=\s*(true|false)\s*', line):
    lines[i] = 'enable_confirmations = false\n'
    found += 1
if found != 1:
  raise SystemExit('Expected one local auth.email confirmation setting')
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
docker cp "$tmp/recovered.dump" "$db:/tmp/mosaic-auth-recovery.dump"
docker exec "$db" pg_restore --list /tmp/mosaic-auth-recovery.dump |
 node "$root/supabase-poc/inspect-archive-toc.mjs" >"$tmp/metadata.json"
docker exec "$db" rm -f /tmp/mosaic-auth-recovery.dump
# Reset the whole disposable local stack; do not replay managed definitions.
supabase db reset --local >/dev/null
db="$(get_db)"
docker exec -i "$db" psql -Xq -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
DO $v$
BEGIN
 IF (SELECT count(*) FROM auth.users)<>0 OR
    (SELECT count(*) FROM auth.sessions)<>0 OR
    (SELECT count(*) FROM public.mosaic_candidate_tasks)<>0 OR
    (SELECT count(*) FROM public.mosaic_candidate_categories)<>0 OR
    (SELECT count(*) FROM mosaic_candidate_private.core_authorities)<>0 THEN
    RAISE EXCEPTION 'Non-empty disposable recovery target'; END IF;
END $v$;
ALTER TABLE public.mosaic_candidate_categories DISABLE TRIGGER USER;
ALTER TABLE public.mosaic_candidate_tasks DISABLE TRIGGER USER;
SQL
docker cp "$tmp/recovered.dump" "$db:/tmp/mosaic-auth-recovery.dump"
docker exec "$db" pg_restore --list /tmp/mosaic-auth-recovery.dump >"$tmp/all.toc"
restore_data() {
  awk -v s="$1" -v t="$2" '
    /^;/ { print; next }
    /TABLE DATA/ {if ($0 ~ ("TABLE DATA " s " " t " ")) print}
  ' "$tmp/all.toc" >"$tmp/only.toc"
  test "$(grep -c 'TABLE DATA' "$tmp/only.toc")" -eq 1 || {
    echo 'Missing or ambiguous approved recovery data entry' >&2; exit 1
  }
  docker cp "$tmp/only.toc" "$db:/tmp/mosaic-auth-selection.toc"
  docker exec "$db" pg_restore -U postgres -d postgres --data-only --no-owner \
    --exit-on-error --use-list=/tmp/mosaic-auth-selection.toc \
    /tmp/mosaic-auth-recovery.dump
}
restore_data auth users
restore_data auth identities
# Auth's native INSERT fires the reviewed fresh-owner enrollment trigger.
# Never disable managed auth.users triggers. On this verified-empty synthetic
# target only, replace that auto-enrolled ledger with its archived owner state.
docker exec -i "$db" psql -Xq -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
DO $v$
BEGIN
 IF (SELECT count(*) FROM mosaic_candidate_private.core_authorities)<>1 THEN
  RAISE EXCEPTION 'Expected one fresh authority after native Auth trigger';
 END IF;
END $v$;
DELETE FROM mosaic_candidate_private.core_authorities;
SQL
restore_data mosaic_candidate_private core_authorities
restore_data mosaic_candidate_private owner_revisions
restore_data public mosaic_candidate_categories
restore_data public mosaic_candidate_tasks
docker exec -i "$db" psql -Xq -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
ALTER TABLE public.mosaic_candidate_categories ENABLE TRIGGER USER;
ALTER TABLE public.mosaic_candidate_tasks ENABLE TRIGGER USER;
DO $v$
BEGIN
 IF (SELECT count(*) FROM auth.users)<>1 OR
    (SELECT count(*) FROM auth.identities)<>1 OR
    (SELECT count(*) FROM auth.sessions)<>0 OR
    (SELECT count(*) FROM mosaic_candidate_private.core_authorities)<>1 OR
    (SELECT count(*) FROM mosaic_candidate_private.owner_revisions)<>1 OR
    (SELECT count(*) FROM public.mosaic_candidate_categories)<>1 OR
    (SELECT count(*) FROM public.mosaic_candidate_tasks)<>1 THEN
   RAISE EXCEPTION 'Incorrect recovered Auth/core data'; END IF;
END $v$;
SQL
docker exec "$db" rm -f /tmp/mosaic-auth-recovery.dump /tmp/mosaic-auth-selection.toc
node "$root/supabase-poc/tests/real-auth-restore-local.mjs" verify
echo 'REAL_GOTRUE_LOCAL_RESTORE_PASS: password, owner, revisions, denied prior session and signed foreign access'
