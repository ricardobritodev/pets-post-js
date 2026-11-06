#!/usr/bin/env bash
# Volta para a versão anterior da v2 (o Flask foi aposentado; o "plano B" é a versão de antes).
#
#   sudo -u petspost bash /srv/petspost/current/deploy/rollback.sh
#
# Atenção: migrations de banco não são desfeitas. Se a versão nova mudou o banco, restaure
# também o backup (deploy/README.md, "Restaurar backup").
set -euo pipefail
APP_DIR=/srv/petspost
CURRENT="$(readlink -f "$APP_DIR/current")"
TARGET="$(ls -1dt "$APP_DIR"/releases/*/ | sed 's:/$::' | grep -vx "$CURRENT" | head -n 1 || true)"
[[ -n "$TARGET" ]] || { echo "Não há versão anterior."; exit 1; }
echo "Saindo de:  $(cat "$CURRENT/RELEASE" 2>/dev/null || basename "$CURRENT")"
echo "Voltando a: $(cat "$TARGET/RELEASE" 2>/dev/null || basename "$TARGET")"
ln -sfn "$TARGET" "$APP_DIR/current.tmp" && mv -Tf "$APP_DIR/current.tmp" "$APP_DIR/current"
# A versão desfeita vai para o fim da fila, para um segundo rollback não voltar para ela.
touch -d '2000-01-01' "$CURRENT"
sudo systemctl restart petspost
echo "Pronto."
