#!/usr/bin/env bash
set -euo pipefail
DB="${UZ_DB:-$HOME/.uz-watch/uz.sqlite}"
DEST="${1:-$HOME/.uz-watch/backup}"
mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M)
sqlite3 "$DB" ".backup '$DEST/uz-$STAMP.sqlite'"
ls -1t "$DEST"/uz-*.sqlite | tail -n +15 | xargs -r rm --
echo "backup: $DEST/uz-$STAMP.sqlite"
