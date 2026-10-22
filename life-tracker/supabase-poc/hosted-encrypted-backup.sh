#!/usr/bin/env bash
# #1027: source-read-only, age-encrypted logical snapshot for mosaic-dev.
# This is NOT independent restore/backup acceptance and does not capture
# Supabase Auth configuration secrets, external Storage bytes, or global roles.
set -euo pipefail
umask 077

if [[ $# -ne 1 || "$1" != /* || "$1" != *.age ]]; then
  echo 'Usage: bash supabase-poc/hosted-encrypted-backup.sh /absolute/outside-repo/snapshot.age' >&2
  exit 2
fi
out="$1"
repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
parent="$(cd "$(dirname "$out")" && pwd -P)"
case "$parent" in "$repo"|"$repo"/*) echo 'Refusing to write inside Git repository' >&2; exit 2 ;; esac
: "$PGHOST" "$PGUSER" "$PGPASSWORD" "$PGDATABASE" "$MOSAIC_AGE_RECIPIENT" "$MOSAIC_AGE_IDENTITY_FILE"
project='hcxtiifzxoaflhjgoglb'
if [[ "$PGDATABASE" != postgres ]] ||
   ! [[ "$PGHOST" == "db.$project.supabase.co" ||
         ( "$PGHOST" == *.pooler.supabase.com && "$PGUSER" == "postgres.$project" ) ]]; then
  echo 'Refusing non-mosaic-dev source database' >&2
  exit 2
fi
[[ -f "$MOSAIC_AGE_IDENTITY_FILE" && ! -e "$out" ]] || {
  echo 'Missing age identity or output already exists' >&2; exit 2;
}
command -v pg_dump >/dev/null
command -v age >/dev/null
command -v pg_restore >/dev/null
command -v sha256sum >/dev/null
export PGSSLMODE=require
partial="$(mktemp "$out.partial.XXXXXXXX")"
trap 'rm -f -- "$partial"' EXIT
pg_dump --format=custom --no-password --dbname=postgres |
  age --encrypt --recipient "$MOSAIC_AGE_RECIPIENT" > "$partial"
# pg_restore --list may read just the TOC and close stdin before the
# decrypted archive payload ends. Verify the entire ciphertext independently
# before tolerating the resulting producer SIGPIPE in the metadata-only pass.
age --decrypt --identity "$MOSAIC_AGE_IDENTITY_FILE" "$partial" > /dev/null
set +e
age --decrypt --identity "$MOSAIC_AGE_IDENTITY_FILE" "$partial" |
  pg_restore --list > /dev/null
inspect_status=("${PIPESTATUS[@]}")
set -e
if (( inspect_status[1] != 0 ||
      (inspect_status[0] != 0 && inspect_status[0] != 141) )); then
  echo 'Encrypted PostgreSQL archive inspection failed' >&2
  exit 1
fi
[[ "$(stat -c '%s' "$partial")" -ge 1024 ]] || {
  echo 'Encrypted output unexpectedly small' >&2; exit 1;
}
# Atomic no-clobber publication. Keep encrypted bytes and age secret separate.
ln -- "$partial" "$out"
printf 'Encrypted snapshot created (archive SHA-256): '
sha256sum "$out" | cut -d ' ' -f1
printf 'Independent restore and object/Auth configuration checks still required.\n'
