#!/usr/bin/env bash
# Offline, read-only archive plan. DATA-only SQL decodes to /dev/null.
set -euo pipefail
umask 077
if [[ $# -ne 2 || "$1" != /* || "$2" != /* || ! -f "$1" || ! -f "$2" ]]; then
  echo 'Usage: bash supabase-poc/check-private-archive-data.sh /absolute/backup.age /absolute/key.agekey' >&2
  exit 2
fi
for bin in age pg_restore node mktemp; do
  command -v "$bin" >/dev/null || { echo "Missing $bin" >&2; exit 2; }
done
archive="$1"
identity="$2"
here="$(cd "$(dirname "$0")" && pwd -P)"
tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT
chmod 700 "$tmp"
# Authenticate full ciphertext before any truncated TOC stream is trusted.
age --decrypt --identity "$identity" "$archive" >/dev/null || {
  echo 'Encrypted archive authentication failed' >&2; exit 1;
}
set +e
age --decrypt --identity "$identity" "$archive" |
  pg_restore --list |
  node "$here/plan-private-archive-data.mjs" --plan-file "$tmp/selection.toc"
status=(${PIPESTATUS[@]})
set -e
if (( status[2] != 0 || status[1] != 0 ||
      (status[0] != 0 && status[0] != 141) )); then
  echo 'Offline TOC planning failed' >&2; exit 1
fi
test -s "$tmp/selection.toc"
# No connection string or target database. All selected SQL is discarded.
set +e
age --decrypt --identity "$identity" "$archive" |
  pg_restore --data-only --no-owner --use-list="$tmp/selection.toc" \
    --file=/dev/null - >"$tmp/stdout" 2>"$tmp/stderr"
status=(${PIPESTATUS[@]})
set -e
if (( status[1] != 0 || (status[0] != 0 && status[0] != 141) )); then
  echo 'Selected archive data could not be decoded (no database touched)' >&2
  # This diagnostic is exclusively for generated-data GitHub Actions fixtures.
  if [[ "${MOSAIC_SYNTHETIC_RESTORE_LAB:-}" == 1 && "${GITHUB_ACTIONS:-}" == true ]]; then
    sed -n '1,8p' "$tmp/stderr" >&2
  fi
  exit 1
fi
echo 'SELECTED_DATA_DECODE_PASS: six required data payloads decoded to /dev/null; zero restores.'
