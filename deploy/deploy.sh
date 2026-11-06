#!/usr/bin/env bash
# Publica uma versão nova (T7.14). Rode como o usuário petspost:
#
#   sudo -u petspost bash /srv/petspost/current/deploy/deploy.sh          # último commit da main
#   sudo -u petspost bash /srv/petspost/current/deploy/deploy.sh v1.2.0   # uma tag
#
# Cada versão fica em /srv/petspost/releases/<data>; "current" é um link para a ativa.
# Se o health check falhar, volta sozinho para a versão anterior.
set -euo pipefail

REF="${1:-main}"
APP_DIR=/srv/petspost
REPO="$(cat /etc/petspost/repo)"
STAMP="$(date +%Y%m%d-%H%M%S)"
NEW="$APP_DIR/releases/$STAMP"
PREVIOUS="$(readlink -f "$APP_DIR/current" 2>/dev/null || true)"
log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

[[ "$(id -un)" == petspost ]] || { echo "Rode como petspost: sudo -u petspost bash $0"; exit 1; }
set -a; source /etc/petspost/petspost.env; set +a

log "Baixando $REF"
git clone --quiet --depth 1 --branch "$REF" "$REPO" "$NEW"
cd "$NEW"
git log -1 --format='%h %s' | tee "$NEW/RELEASE"

log "Dependências e build"
# NODE_ENV=production faria o npm pular o Vite e o Prisma CLI (devDependencies), que o build precisa.
NODE_ENV=development npm ci --no-audit --no-fund
npm run build

log "Migrations do banco"
npm run db:deploy

log "Ativando a versão nova"
ln -sfn "$NEW" "$APP_DIR/current.tmp"
mv -Tf "$APP_DIR/current.tmp" "$APP_DIR/current"
sudo systemctl restart petspost

log "Health check"
ok=""
for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/api/v1/health/db >/dev/null; then ok=1; break; fi
  sleep 1
done
if [[ -z "$ok" ]]; then
  echo "A versão nova não respondeu."
  if [[ -n "$PREVIOUS" ]]; then
    echo "Voltando para $(basename "$PREVIOUS")."
    ln -sfn "$PREVIOUS" "$APP_DIR/current.tmp" && mv -Tf "$APP_DIR/current.tmp" "$APP_DIR/current"
    sudo systemctl restart petspost
  fi
  exit 1
fi

log "Limpando versões antigas (fica com as 5 últimas)"
ls -1dt "$APP_DIR"/releases/*/ | tail -n +6 | xargs -r rm -rf

echo
echo "No ar: $(cat "$NEW/RELEASE")"
