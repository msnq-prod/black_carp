#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

APP_DIR="${BLACK_CARP_APP_DIR:-/srv/www/black-carp}"
BACKUP_DIR="${BLACK_CARP_BACKUP_DIR:-/srv/backups/black-carp}"
KEEP_DAYS="${BLACK_CARP_BACKUP_KEEP_DAYS:-14}"
NODE_BIN="${BLACK_CARP_NODE_BIN:-$(command -v node || true)}"
DB_PATH="${BLACK_CARP_DB_PATH:-${DB_PATH:-$APP_DIR/data/black-carp.sqlite}}"
UPLOADS_PATH="${BLACK_CARP_UPLOADS_PATH:-$APP_DIR/uploads}"
OFFSITE_HOOK="${BLACK_CARP_BACKUP_HOOK:-}"

cd "$APP_DIR"

if [[ ! "$KEEP_DAYS" =~ ^[0-9]+$ ]]; then
  echo "BLACK_CARP_BACKUP_KEEP_DAYS must be a non-negative integer" >&2
  exit 64
fi
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Node.js executable is required; set BLACK_CARP_NODE_BIN" >&2
  exit 69
fi
if (( $("$NODE_BIN" -p "Number(process.versions.node.split('.')[0])") < 22 )); then
  echo "Node.js 22 or newer is required for backup verification" >&2
  exit 69
fi
if [[ ! -f "$DB_PATH" ]]; then
  echo "Database not found" >&2
  exit 66
fi
if [[ ! -d "$UPLOADS_PATH" ]]; then
  echo "Uploads directory not found" >&2
  exit 66
fi
if [[ -n "$OFFSITE_HOOK" && ! -x "$OFFSITE_HOOK" ]]; then
  echo "BLACK_CARP_BACKUP_HOOK must point to an executable" >&2
  exit 69
fi

mkdir -p "$BACKUP_DIR"
lock_dir=""
if command -v flock >/dev/null 2>&1; then
  exec 9>"$BACKUP_DIR/.backup.lockfile"
  if ! flock -n 9; then
    echo "Another Black Carp backup is already running" >&2
    exit 75
  fi
else
  lock_dir="$BACKUP_DIR/.backup.lockdir"
  if ! mkdir "$lock_dir" 2>/dev/null; then
    echo "Another Black Carp backup is already running; remove a stale $lock_dir manually" >&2
    exit 75
  fi
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
work_dir="$(mktemp -d "$BACKUP_DIR/.backup-$timestamp.XXXXXX")"
cleanup() {
  rm -rf "$work_dir"
  if [[ -n "$lock_dir" ]]; then rm -rf "$lock_dir"; fi
}
trap cleanup EXIT

db_name="black-carp-$timestamp.sqlite"
uploads_name="black-carp-uploads-$timestamp.tar.gz"
checksum_name="black-carp-$timestamp.sha256"
export DB_PATH
export BACKUP_FILE="$work_dir/$db_name"

"$NODE_BIN" "$APP_DIR/ops/backup-db.js"
tar -C "$UPLOADS_PATH" -czf "$work_dir/$uploads_name" .
(
  cd "$work_dir"
  sha256sum "$db_name" "$uploads_name" > "$checksum_name"
)
BLACK_CARP_NODE_BIN="$NODE_BIN" "$APP_DIR/ops/verify-restore.sh" \
  "$work_dir/$db_name" \
  "$work_dir/$uploads_name" \
  "$work_dir/$checksum_name"

mv "$work_dir/$db_name" "$BACKUP_DIR/$db_name"
mv "$work_dir/$uploads_name" "$BACKUP_DIR/$uploads_name"
mv "$work_dir/$checksum_name" "$BACKUP_DIR/$checksum_name"

if [[ -n "$OFFSITE_HOOK" ]]; then
  "$OFFSITE_HOOK" \
    "$BACKUP_DIR/$db_name" \
    "$BACKUP_DIR/$uploads_name" \
    "$BACKUP_DIR/$checksum_name"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f ! -name '.backup.lockfile' -mtime "+$KEEP_DAYS" -delete
echo "Backup verified: $checksum_name"
