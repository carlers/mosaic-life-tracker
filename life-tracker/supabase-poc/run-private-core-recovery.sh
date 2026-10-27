#!/usr/bin/env bash
# Restores only exactly reviewed 6/7/8/10 TABLE DATA objects into a brand-new
# local Supabase project. Does NOT modify existing local/hosted projects.
set -euo pipefail
umask 077
safe_stage() {
  # Fixed, non-sensitive classification only; outer restore never publishes
  # arbitrary Docker/CLI/SQL stderr or source row data.
  printf 'MOSAIC_LOCAL_DR_SAFE_STAGE: %s\n' "$1"
}
safe_stage SOURCE_PREFLIGHT

if [[ ( $# -ne 2 && $# -ne 4 ) || "$1" != /* || "$2" != /* || ! -f "$1" || ! -f "$2" ]]; then
  echo 'Usage: bash supabase-poc/run-private-core-recovery.sh /ABSOLUTE/backup.age /ABSOLUTE/key.agekey [--fresh-snapshot-sha256|--fresh-personal-settings-sha256|--fresh-personal-bucket-links-sha256|--fresh-personal-identity-sha256 64-lowercase-hex-digest]' >&2
  exit 2
fi
# Never accept an ambient override: a fresh source is an explicit operator
# action after independently recording the checksum of a newly encrypted dump.
if [[ ${MOSAIC_FRESH_SNAPSHOT_SHA256+x} || ${MOSAIC_PERSONAL_SETTINGS_RESTORE+x} || ${MOSAIC_BUCKET_LINKS_RESTORE+x} || ${MOSAIC_IDENTITY_REGISTRY_RESTORE+x} ]]; then
  echo 'Refusing inherited archive/table-mode approval variable' >&2
  exit 2
fi
if [[ $# -eq 4 ]]; then
  if [[ ( "$3" != "--fresh-snapshot-sha256" && "$3" != "--fresh-personal-settings-sha256" && "$3" != "--fresh-personal-bucket-links-sha256" && "$3" != "--fresh-personal-identity-sha256" ) ||
       ! "$4" =~ ^[a-f0-9]{64}$ ]]; then
    echo 'Fresh snapshot requires exact lowercase digest and reviewed table mode' >&2
    exit 2
  fi
  export MOSAIC_FRESH_SNAPSHOT_SHA256="$4"
  if [[ "$3" == "--fresh-personal-identity-sha256" ]]; then
    export MOSAIC_IDENTITY_REGISTRY_RESTORE=1
  fi
  if [[ "$3" == "--fresh-personal-settings-sha256" || "$3" == "--fresh-personal-bucket-links-sha256" || "$3" == "--fresh-personal-identity-sha256" ]]; then
    export MOSAIC_PERSONAL_SETTINGS_RESTORE=1
  fi
  if [[ "$3" == "--fresh-personal-bucket-links-sha256" || "$3" == "--fresh-personal-identity-sha256" ]]; then
    export MOSAIC_BUCKET_LINKS_RESTORE=1
  fi
fi
[[ "$(uname -s)" == Linux ]] || { echo 'Local Linux required' >&2; exit 2; }
for cmd in docker supabase python3 age; do
  command -v "$cmd" >/dev/null || { echo "Missing prerequisite: $cmd" >&2; exit 2; }
done
for forbidden in SUPABASE_ACCESS_TOKEN DATABASE_URL PGHOST PGSERVICE PGUSER PGPASSWORD PGDATABASE; do
  if printenv "$forbidden" >/dev/null; then
    echo 'Unset externally configured PostgreSQL/Supabase credentials first' >&2
    exit 2
  fi
done
safe_stage DOCKER_LOCAL_GUARD
endpoint="$(docker context inspect "$(docker context show)" --format '{{.Endpoints.docker.Host}}')"
[[ "$endpoint" == unix://* ]] || {
  echo 'Refusing remote Docker daemon; use the local Unix socket' >&2
  exit 2
}
if printenv DOCKER_HOST >/dev/null && [[ "$(printenv DOCKER_HOST)" != unix://* ]]; then
  echo 'DOCKER_HOST may not point at a remote daemon' >&2
  exit 2
fi

archive="$1"
identity="$2"
here="$(cd "$(dirname "$0")" && pwd -P)"
project="mosaic_dr_$(python3 -c 'import secrets; print(secrets.token_hex(6))')"
scratch="$(mktemp -d "$HOME/.mosaic-private-recovery-XXXXXXXX")"
chmod 700 "$scratch"
private_network="mosaic_dr_net_$(python3 -c 'import secrets; print(secrets.token_hex(6))')"
success=0
cleanup() {
  if (( success == 0 )); then
    # Never invoke CLI stop without an exact, locally generated project ID.
    # It must not fall back to a nearby existing Supabase project.
    if [[ -f "$scratch/supabase/config.toml" ]] &&
      grep -Fqx "project_id = \"$project\"" "$scratch/supabase/config.toml"; then
      (cd "$scratch" && supabase stop --no-backup >/dev/null 2>&1) || true
    fi
    # Remove only this task's uniquely named Docker bridge, never default.
    docker network rm "$private_network" >/dev/null 2>&1 || true
    rm -rf -- "$scratch"
  fi
}
trap cleanup EXIT
# Supabase's official private development recipe: an independent bridge with
# host binding fixed to loopback BEFORE any container is created.
safe_stage NETWORK_INIT
docker network create --driver bridge \
  -o com.docker.network.bridge.host_binding_ipv4=127.0.0.1 \
  "$private_network" >/dev/null || {
  echo 'Could not create independent loopback-only Docker bridge' >&2
  exit 1
}
cd "$scratch"
safe_stage STACK_INIT
supabase init --yes >/dev/null
safe_stage SCHEMA_PREPARE
mkdir -p supabase/migrations
index=0
for migration in \
  20261018_candidate_task_category_owner_schema \
  20261018_candidate_revoke_default_delete \
  20261019_candidate_atomic_cas_rpc \
  20261020_candidate_task_protected_fields \
  20261020_core_fresh_identity_authority \
  20261021_core_realtime_publication; do
  printf -v stamp '2026102000%04d' "$index"
  cp "$here/migrations/$migration.sql" "supabase/migrations/$stamp"_"$migration.sql"
  index=$((index+1))
done
if [[ $# -eq 4 ]]; then
  # Live hosted mosaic-dev has private Diary but has NOT applied category
  # retirement or atomic category-delete migrations (read-only verified).
  # Match only the currently installed fresh-source schema here, never widen
  # the restore target with unrelated future feature migrations.
  for migration in 20261022_candidate_private_diary_domain; do
    printf -v stamp '2026102000%04d' "$index"
    cp "$here/migrations/$migration.sql" "supabase/migrations/$stamp"_"$migration.sql"
    index=$((index+1))
  done
  if [[ ${MOSAIC_PERSONAL_SETTINGS_RESTORE:-} == 1 ]]; then
    printf -v stamp '2026102000%04d' "$index"
    cp "$here/migrations/20261025_candidate_private_personal_settings.sql" "supabase/migrations/$stamp"_personal_settings.sql
    index=$((index+1))
  fi
  if [[ ${MOSAIC_BUCKET_LINKS_RESTORE:-} == 1 ]]; then
    printf -v stamp '2026102000%04d' "$index"
    cp "$here/migrations/20261025_candidate_private_bucket_links.sql" "supabase/migrations/$stamp"_private_bucket_links.sql
  fi
fi
if [[ ${MOSAIC_IDENTITY_REGISTRY_RESTORE:-} == 1 ]]; then
  cp "$here/migrations/20261027170802_mosaic_account_registry.sql" supabase/migrations/20261027170802_mosaic_account_registry.sql
  cp "$here/migrations/20261027172600_personal_runtime_readiness.sql" supabase/migrations/20261027172600_personal_runtime_readiness.sql
fi
python3 "$here/configure-private-disposable-stack.py" init "$scratch" "$project"
# No user backup is decrypted before stack identity, empty-target and loopback
# publication checks all succeed. Failures auto-destroy only this project.
safe_stage STACK_START
supabase start --network-id "$private_network" \
  --exclude realtime,storage,functions,studio,mail,analytics,pooler \
  >"$scratch/start.stdout" 2>"$scratch/start.stderr" || {
  echo 'Could not initialize a separate local Supabase stack' >&2; exit 1;
}
# A new supabase start initializes its own database and applies all six
# migrations. A subsequent db reset is redundant and may fail when using the
# independent private Docker network; the restore engine separately verifies
# the schema and all relevant tables are empty before it reads user data.
safe_stage LOOPBACK_VERIFY
python3 "$here/configure-private-disposable-stack.py" check "$scratch" "$project"
db="$(docker ps --filter "name=supabase_db_$project" --format '{{.ID}}')"
[[ -n "$db" && "$db" != *$'\n'* ]] || {
  echo 'Unable to uniquely identify the new disposable DB container' >&2; exit 1;
}
safe_stage ROW_RESTORE
python3 "$here/restore_private_core_to_disposable.py" "$archive" "$identity" "$db"
rm -f "$scratch/start.stdout" "$scratch/start.stderr"
success=1
echo "ISOLATED_LOCAL_STACK_READY: $project"
echo "PRIVATE_DOCKER_NETWORK: $private_network"
echo "PRIVATE_LOCAL_DIRECTORY: $scratch"
echo "LOCAL_AUTH_API: http://127.0.0.1:$(cat "$scratch/mosaic-disposable-api-port")"
echo 'Fresh password sign-in and signed multi-owner privacy tests remain required.'
echo 'After testing, stop the printed private project using supabase stop --no-backup and remove ONLY the printed private network.'
