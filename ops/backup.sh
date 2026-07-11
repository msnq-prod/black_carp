#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

APP_DIR="${BLACK_CARP_APP_DIR:-/srv/www/black-carp}"
BACKUP_DIR="${BLACK_CARP_BACKUP_DIR:-/srv/backups/black-carp}"
KEEP_DAYS="${BLACK_CARP_BACKUP_KEEP_DAYS:-14}"
ENV_FILE="${BLACK_CARP_ENV_FILE:-$APP_DIR/.env}"

cd "$APP_DIR"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
export DB_PATH="${DB_PATH:-$APP_DIR/data/black-carp.sqlite}"
export BACKUP_FILE="$BACKUP_DIR/black-carp-$timestamp.sqlite"

node "$APP_DIR/ops/backup-db.js"
tar -C "$APP_DIR" -czf "$BACKUP_DIR/black-carp-uploads-$timestamp.tar.gz" uploads/booking
find "$BACKUP_DIR" -type f -mtime "+$KEEP_DAYS" -delete
