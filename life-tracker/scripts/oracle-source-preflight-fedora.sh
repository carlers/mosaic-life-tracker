#!/usr/bin/env bash
# Read-only original Appwrite Cloud R2 source assessment; no Oracle mutation.
set -Eeuo pipefail
set +x
umask 077
cd "$(dirname "$0")/.."
for bin in node npm; do
  command -v "$bin" >/dev/null || { echo "BLOCKED: missing Node/npm prerequisite"; exit 2; }
done
if ! (: </dev/tty) 2>/dev/null; then
  echo "BLOCKED: interactive owner terminal required"; exit 2
fi
echo MOSAIC_LEGACY_APPWRITE_R2_SOURCE_READONLY_BEGIN
echo "Use original Appwrite Cloud DR/R2 reader credentials, NOT the Oracle preliminary R2 keys."
echo "The source DR key (base64) is NOT the Oracle age private identity."
if [[ -z "${R2_ACCOUNT_ID:-}" ]]; then
  read -r -p "Original Appwrite DR R2 account ID: " R2_ACCOUNT_ID </dev/tty
fi
if [[ -z "${R2_BUCKET:-}" ]]; then
  read -r -p "Original Appwrite DR R2 bucket: " R2_BUCKET </dev/tty
fi
if [[ -z "${R2_ACCESS_KEY_ID:-}" ]]; then
  read -r -s -p "Original Appwrite DR R2 READ-ONLY Access Key ID: " R2_ACCESS_KEY_ID </dev/tty
  printf '\n'
fi
if [[ -z "${R2_SECRET_ACCESS_KEY:-}" ]]; then
  read -r -s -p "Original Appwrite DR R2 READ-ONLY Secret: " R2_SECRET_ACCESS_KEY </dev/tty
  printf '\n'
fi
if [[ -z "${DR_ENCRYPTION_KEY_B64:-}" && -z "${DR_ENCRYPTION_KEYS_JSON:-}" ]]; then
  read -r -s -p "Original Appwrite Cloud DR key (base64): " DR_ENCRYPTION_KEY_B64 </dev/tty
  printf '\n'
fi
for key in R2_ACCOUNT_ID R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  [[ -n "${!key:-}" ]] || { echo "BLOCKED: missing R2 source input"; exit 2; }
done
[[ -n "${DR_ENCRYPTION_KEY_B64:-}${DR_ENCRYPTION_KEYS_JSON:-}" ]] || {
  echo "BLOCKED: missing source DR decryption key"; exit 2;
}
export R2_ACCOUNT_ID R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY
export DR_ENCRYPTION_KEY_B64="${DR_ENCRYPTION_KEY_B64:-}"
export DR_ENCRYPTION_KEYS_JSON="${DR_ENCRYPTION_KEYS_JSON:-}"
export DR_PREFIX="${DR_PREFIX:-mosaic-dr/v1}"
export DR_KEY_VERSION="${DR_KEY_VERSION:-v1}"
unset APPWRITE_TARGET_API_KEY APPWRITE_TARGET_ENDPOINT || true
echo MOSAIC_LEGACY_APPWRITE_R2_SOURCE_ONLY_NO_ORACLE_MUTATION
node scripts/dr-restore.mjs --preflight-only --latest
echo MOSAIC_LEGACY_APPWRITE_R2_SOURCE_PREFLIGHT_COMPLETE
