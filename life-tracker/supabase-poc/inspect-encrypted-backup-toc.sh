#!/usr/bin/env bash
# Read-only inspection of a private age-encrypted pg_dump archive.
# No database connection, plaintext output file, credential logging or restore.
set -euo pipefail
umask 077
if [[ $# -ne 2 || "$1" != /* || "$2" != /* ||
      ! -f "$1" || ! -f "$2" ]]; then
  echo 'Usage: bash supabase-poc/inspect-encrypted-backup-toc.sh /absolute/backup.age /absolute/identity.agekey' >&2
  exit 2
fi
for command in age pg_restore node; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 2; }
done
archive="$1"
identity="$2"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

# Authenticate ALL encrypted bytes, not merely the TOC prefix. Read-only.
age --decrypt --identity "$identity" "$archive" >/dev/null

inspect() {
  set +e
  age --decrypt --identity "$identity" "$archive" |
    pg_restore --list |
    node "$script_dir/inspect-archive-toc.mjs"
  local codes=("${PIPESTATUS[@]}")
  set -e
  if (( codes[2] != 0 || codes[1] != 0 ||
        (codes[0] != 0 && codes[0] != 141) )); then
    echo 'Failed to inspect authenticated PostgreSQL TOC' >&2
    return 1
  fi
}
summary="$(inspect)" || exit 1
printf '%s\n' "$summary"
printf '%s\n' 'Metadata inspection only. No data restored and no recovery acceptance granted.'
