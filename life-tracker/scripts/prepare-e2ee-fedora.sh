#!/usr/bin/env bash
# Exact-SHA Fedora owner operator for Mosaic #1662. No Production access.
set -Eeuo pipefail
umask 077
[[ "${EUID}" != 0 ]] || { echo 'Run as normal Fedora user, not root' >&2; exit 1; }
for tool in git npm node; do
  command -v "$tool" >/dev/null || { echo "Missing $tool" >&2; exit 1; }
done
[[ "$(node --version)" == v22.* ]] || { echo 'Node.js 22.x required' >&2; exit 1; }
: "${MOSAIC_E2EE_APPROVED_SHA:?Pinned reviewed Git commit required}"
cd "$(dirname "${BASH_SOURCE[0]}")/.."
[[ "$(git rev-parse HEAD)" == "$MOSAIC_E2EE_APPROVED_SHA" ]] ||
  { echo 'Refusing unreviewed checkout' >&2; exit 1; }
git fetch --quiet origin dev
npm ci --no-audit --no-fund
npm exec -- vitest run --project handlers tests/handlers/e2eePilot.test.ts
node --test scripts/tests/prepare-e2ee-scratch.test.mjs
VERCEL_ENV=preview \
  VITE_APPWRITE_PROJECT_ID=6ae94a2100014d01f5ed \
  VITE_APPWRITE_ENDPOINT=https://129-221-244-67.sslip.io/v1 \
  VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID=6aa8057f002a4c306fdd \
  npm run build
if [[ -z "${APPWRITE_API_KEY:-}" ]]; then
  [[ -r /dev/tty ]] || { echo 'Interactive terminal required for Scratch key' >&2; exit 1; }
  read -r -s -p 'Oracle Scratch-scoped Appwrite API key: ' APPWRITE_API_KEY </dev/tty
  echo
fi
export APPWRITE_API_KEY
[[ -n "$APPWRITE_API_KEY" ]] || { echo 'Empty Scratch API key' >&2; exit 1; }
trap 'unset APPWRITE_API_KEY' EXIT
node scripts/prepare-e2ee-scratch.mjs \
  --git-sha "$MOSAIC_E2EE_APPROVED_SHA" \
  --project 6ae94a2100014d01f5ed \
  --endpoint https://129-221-244-67.sslip.io/v1 \
  --confirm-project 6ae94a2100014d01f5ed
