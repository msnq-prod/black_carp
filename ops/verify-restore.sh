#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if (( $# < 2 || $# > 3 )); then
  echo "Usage: verify-restore.sh DB_BACKUP UPLOADS_ARCHIVE [CHECKSUM_FILE]" >&2
  exit 64
fi

DB_BACKUP="$1"
UPLOADS_ARCHIVE="$2"
CHECKSUM_FILE="${3:-}"
NODE_BIN="${BLACK_CARP_NODE_BIN:-$(command -v node || true)}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for required in "$DB_BACKUP" "$UPLOADS_ARCHIVE"; do
  if [[ ! -f "$required" ]]; then
    echo "Backup component not found" >&2
    exit 66
  fi
done
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Node.js executable is required" >&2
  exit 69
fi

if [[ -n "$CHECKSUM_FILE" ]]; then
  if [[ ! -f "$CHECKSUM_FILE" ]]; then
    echo "Checksum file not found" >&2
    exit 66
  fi
  (
    cd "$(dirname "$CHECKSUM_FILE")"
    sha256sum --check "$(basename "$CHECKSUM_FILE")"
  )
fi

while IFS= read -r entry; do
  case "$entry" in
    /*|../*|*/../*|..)
      echo "Unsafe path in uploads archive" >&2
      exit 65
      ;;
  esac
done < <(tar -tzf "$UPLOADS_ARCHIVE")

while IFS= read -r entry; do
  file_type="${entry:0:1}"
  case "$file_type" in
    -|d) ;;
    *)
      echo "Unsupported link or special file in uploads archive" >&2
      exit 65
      ;;
  esac
done < <(tar -tvzf "$UPLOADS_ARCHIVE")

restore_dir="$(mktemp -d "${TMPDIR:-/tmp}/black-carp-restore.XXXXXX")"
cleanup() {
  rm -rf "$restore_dir"
}
trap cleanup EXIT

mkdir -p "$restore_dir/data" "$restore_dir/uploads"
cp "$DB_BACKUP" "$restore_dir/data/black-carp.sqlite"
tar -xzf "$UPLOADS_ARCHIVE" -C "$restore_dir/uploads"
"$NODE_BIN" "$SCRIPT_DIR/verify-backup.js" "$restore_dir/data/black-carp.sqlite" "$restore_dir"
