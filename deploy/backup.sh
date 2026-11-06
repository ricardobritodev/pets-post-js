#!/usr/bin/env bash
# Backup diário (cron do setup-server.sh): banco + fotos, guardando 14 dias em /var/backups/petspost.
# Copie essa pasta para fora do VPS de vez em quando (deploy/README.md, "Backup").
set -euo pipefail
DEST=/var/backups/petspost
STAMP="$(date +%Y%m%d-%H%M%S)"
umask 077
set -a; source /etc/petspost/petspost.env; set +a

# mysql://usuario:senha@host:porta/banco
re='^mysql://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/([^?]+)'
[[ "$DATABASE_URL" =~ $re ]] || { echo "DATABASE_URL inesperada"; exit 1; }
MYSQL_PWD="${BASH_REMATCH[2]}" mysqldump --single-transaction --routines --no-tablespaces \
  -u "${BASH_REMATCH[1]}" -h "${BASH_REMATCH[3]}" -P "${BASH_REMATCH[4]:-3306}" "${BASH_REMATCH[5]}" \
  | gzip > "$DEST/db-$STAMP.sql.gz"

tar -czf "$DEST/uploads-$STAMP.tar.gz" -C /var/lib/petspost uploads

find "$DEST" -type f -mtime +14 -delete
echo "$(date -Is) backup ok: db-$STAMP.sql.gz, uploads-$STAMP.tar.gz"
