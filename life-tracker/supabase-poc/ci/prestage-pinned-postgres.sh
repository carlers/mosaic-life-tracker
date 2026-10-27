#!/usr/bin/env bash
# #1027: deterministic, source-only CI fallback for the upstream GHCR 429.
# Pin the exact official Supabase Docker Hub linux/amd64 MANIFEST, not a
# mutable image tag, a different Postgres release or an arbitrary mirror.
# Official manifest: https://hub.docker.com/layers/supabase/postgres/17.6.1.095/images/sha256-4c087262afbfbb47da86e2863a52d7e424eb21ab589f732d77eeaab51be8e521
# The Supabase CLI 2.81.3 still requests ghcr.io/supabase/postgres:17.6.1.095.
# Prestage only the identical-version signed-by-registry digest into that name;
# all actual disposable Auth/RLS/database/DR checks run unchanged afterward.
set -euo pipefail

source_image='docker.io/supabase/postgres@sha256:4c087262afbfbb47da86e2863a52d7e424eb21ab589f732d77eeaab51be8e521'
target_image='ghcr.io/supabase/postgres:17.6.1.095'
expected_digest='sha256:4c087262afbfbb47da86e2863a52d7e424eb21ab589f732d77eeaab51be8e521'

if [[ "$(uname -m)" != 'x86_64' ]]; then
  echo 'MOSAIC_SUPABASE_POSTGRES_PIN_UNSUPPORTED_ARCH' >&2
  exit 1
fi

# Pulling @sha256 verifies the immutable OCI manifest and layer digests.
# No service token, credentials, force tags, or image-build substitution.
docker pull --platform linux/amd64 "$source_image"
verified_id="$(docker image inspect --format '{{.Id}}' "$source_image")"
verified_platform="$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$source_image")"
verified_digests="$(docker image inspect --format '{{json .RepoDigests}}' "$source_image")"

if [[ -z "$verified_id" || "$verified_platform" != 'linux/amd64' ||
      "$verified_digests" != *"$expected_digest"* ]]; then
  echo 'MOSAIC_SUPABASE_POSTGRES_PIN_VERIFICATION_FAILED' >&2
  exit 1
fi

docker tag "$source_image" "$target_image"
local_id="$(docker image inspect --format '{{.Id}}' "$target_image")"
local_platform="$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$target_image")"
if [[ "$verified_id" != "$local_id" || "$local_platform" != 'linux/amd64' ]]; then
  echo 'MOSAIC_SUPABASE_POSTGRES_PIN_TAG_MISMATCH' >&2
  exit 1
fi
echo 'MOSAIC_SUPABASE_POSTGRES_PIN_PASS'
