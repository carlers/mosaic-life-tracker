#!/usr/bin/env bash
# No hosted credentials or source data. Probe / create only a NEW loopback Docker bridge.
# Never inspect plaintext backup content, prune Docker networks, or change Docker config.
set -euo pipefail
umask 077

safe_stage() { printf 'MOSAIC_LOCAL_DR_SAFE_STAGE: %s\n' "$1"; }

if [[ $# -eq 1 && "$1" == "--probe" ]]; then
  command -v python3 >/dev/null || { safe_stage NETWORK_PREREQUISITE_MISSING; exit 2; }
  network="mosaic_dr_net_$(python3 -c 'import secrets; print(secrets.token_hex(6))')"
  mode=probe
elif [[ $# -eq 2 && "$1" == "--create" && "$2" =~ ^mosaic_dr_net_[a-f0-9]{12}$ ]]; then
  network="$2"
  mode=create
else
  safe_stage NETWORK_UNRECOGNIZED_REQUEST
  exit 2
fi

command -v docker >/dev/null || { safe_stage NETWORK_PREREQUISITE_MISSING; exit 2; }
context="$(docker context show 2>/dev/null)" || {
  safe_stage NETWORK_CONTEXT_UNAVAILABLE; exit 1;
}
endpoint="$(docker context inspect "$context" --format '{{.Endpoints.docker.Host}}' 2>/dev/null)" || {
  safe_stage NETWORK_CONTEXT_UNAVAILABLE; exit 1;
}
docker_host="$(printenv DOCKER_HOST 2>/dev/null || true)"
if [[ "$endpoint" != unix://* || ( -n "$docker_host" && "$docker_host" != unix://* ) ]]; then
  safe_stage NETWORK_REMOTE_DOCKER_DENIED
  exit 1
fi

# Docker stderr may contain host metadata. Keep it private and emit ONLY fixed
# safe categories to the parent recovery process and operator.
error_file="$(mktemp)"
trap 'rm -f -- "$error_file"' EXIT
if ! docker network create --driver bridge \
    -o com.docker.network.bridge.host_binding_ipv4=127.0.0.1 \
    "$network" >/dev/null 2>"$error_file"; then
  if grep -Eiq 'non.overlapping.*(address|pool)|address pool|pool.*exhaust|subnet.*overlap' "$error_file"; then
    safe_stage NETWORK_POOL_EXHAUSTED
  elif grep -Eiq 'permission denied|access denied|operation not permitted' "$error_file"; then
    safe_stage NETWORK_PERMISSION_DENIED
  elif grep -Eiq 'cannot connect to the docker daemon|is the docker daemon running|connection refused|dial unix|no such file or directory' "$error_file"; then
    safe_stage NETWORK_DAEMON_UNAVAILABLE
  else
    safe_stage NETWORK_CREATE_FAILED
  fi
  exit 1
fi

if [[ "$mode" == probe ]]; then
  # Remove ONLY the random bridge created by this exact probe.
  if ! docker network rm "$network" >/dev/null 2>"$error_file"; then
    safe_stage NETWORK_PROBE_CLEANUP_FAILED
    exit 1
  fi
  printf 'MOSAIC_LOCAL_NETWORK_PREFLIGHT_PASS\n'
fi
