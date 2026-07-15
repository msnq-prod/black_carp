#!/usr/bin/env bash
set -Eeuo pipefail

if (( $# != 2 )); then
  echo "Usage: verify-release-image.sh RELEASE_SHA IMAGE@sha256:DIGEST" >&2
  exit 64
fi

release_sha="$1"
image_ref="$2"

if [[ ! "$release_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Release SHA must be a 40-character lowercase git SHA" >&2
  exit 65
fi
if [[ ! "$image_ref" =~ @sha256:[0-9a-f]{64}$ ]]; then
  echo "Image must be pinned by a sha256 digest" >&2
  exit 65
fi

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required" >&2
  exit 69
}

revision="$(docker image inspect "$image_ref" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')"
if [[ "$revision" != "$release_sha" ]]; then
  echo "Image OCI revision does not match release SHA" >&2
  exit 65
fi

embedded_revision="$(docker run --rm --entrypoint cat "$image_ref" /app/REVISION | tr -d '\r\n')"
if [[ "$embedded_revision" != "$release_sha" ]]; then
  echo "Image embedded revision does not match release SHA" >&2
  exit 65
fi

repo_digests="$(docker image inspect "$image_ref" --format '{{ join .RepoDigests "\n" }}')"
if ! printf '%s\n' "$repo_digests" | grep -Fqx "$image_ref"; then
  echo "Image was not resolved from the requested immutable digest" >&2
  exit 65
fi

printf 'Release image verified: %s\n' "$image_ref"
