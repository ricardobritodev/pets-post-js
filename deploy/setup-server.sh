#!/usr/bin/env bash
# Prepara um VPS Ubuntu 24.04 novo para o Pets Post (T7.10/T7.11). Rode como root, uma vez:
#
#   sudo bash setup-server.sh git@github.com:ricardobritodev/pets-post-js.git voce@exemplo.com
#
# 1º argumento: repositório (SSH, com deploy key — ver deploy/README.md)
# 2º argumento: email de contato (Let's Encrypt e User-Agent do Nominatim)
#
# Pode rodar de novo: o que já existe é mantido (senhas e .env não são recriados).
set -euo pipefail

REPO="${1:?Informe o repositório (git@github.com:...)}"
CONTACT="${2:?Informe um email de contato}"
NODE_MAJOR=26          # mesmo do .nvmrc
DOMAIN=www.petspost.com.br
APP_DIR=/srv/petspost
ENV_FILE=/etc/petspost/petspost.env
HERE="$(cd "$(dirname "$0")" && pwd)"

[[ $EUID -eq 0 ]] || { echo "Rode como root (sudo)."; exit 1; }
log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

log "Pacotes do sistema"
apt-get update -y
apt-get install -y ca-certificates curl gnupg git nginx mysql-server certbot python3-certbot-nginx ufw fail2ban unattended-upgrades

log "Node.js ${NODE_MAJOR} (NodeSource)"
if ! node -v 2>/dev/null | grep -q "^v${NODE_MAJOR}\."; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
node -v

log "Firewall: só SSH, HTTP e HTTPS"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

log "Usuário e pastas"
id petspost &>/dev/null || adduser --system --group --home "$APP_DIR" --shell /bin/bash petspost
install -d -o petspost -g petspost "$APP_DIR" "$APP_DIR/releases" /var/lib/petspost/uploads
install -d -o root -g petspost -m 750 /etc/petspost
install -d -o root -g root -m 700 /var/backups/petspost

log "MySQL: banco e usuário"
if [[ ! -f "$ENV_FILE" ]]; then
  DB_PASS="$(openssl rand -hex 24)"
  mysql <<SQL
CREATE DATABASE IF NOT EXISTS petspost CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'petspost'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER 'petspost'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON petspost.* TO 'petspost'@'localhost';
FLUSH PRIVILEGES;
SQL

  log "Arquivo de ambiente ($ENV_FILE)"
  umask 027
  cat > "$ENV_FILE" <<ENV
NODE_ENV=production
API_PORT=3000
DATABASE_URL=mysql://petspost:${DB_PASS}@localhost:3306/petspost
SESSION_SECRET=$(openssl rand -hex 32)
PUBLIC_URL=https://${DOMAIN}
UPLOAD_DIR=/var/lib/petspost/uploads
GEOCODER_USER_AGENT=PetsPost/2.0 (projeto-academico; contato: ${CONTACT})
# Botão flutuante de WhatsApp do site (BR-CONTACT-002): descomente e coloque o número.
# CONTACT_WHATSAPP=(11) 91234-5678
ENV
  chown root:petspost "$ENV_FILE"
  chmod 640 "$ENV_FILE"
else
  echo "$ENV_FILE já existe: mantido."
fi

log "systemd"
install -m 644 "$HERE/petspost.service" /etc/systemd/system/petspost.service
systemctl daemon-reload
systemctl enable petspost

log "sudo só para reiniciar o serviço (usado pelo deploy.sh e rollback.sh)"
cat > /etc/sudoers.d/petspost <<SUDO
petspost ALL=(root) NOPASSWD: /usr/bin/systemctl restart petspost, /usr/bin/systemctl status petspost
SUDO
chmod 440 /etc/sudoers.d/petspost
visudo -cf /etc/sudoers.d/petspost

log "Nginx"
install -m 644 "$HERE/nginx-petspost.conf" /etc/nginx/sites-available/petspost
ln -sf /etc/nginx/sites-available/petspost /etc/nginx/sites-enabled/petspost
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

log "Backup diário às 3h"
install -m 755 "$HERE/backup.sh" /usr/local/bin/petspost-backup
echo "0 3 * * * root /usr/local/bin/petspost-backup >> /var/log/petspost-backup.log 2>&1" > /etc/cron.d/petspost-backup

log "Repositório"
echo "$REPO" > /etc/petspost/repo
echo "$CONTACT" > /etc/petspost/contact

cat <<MSG

Servidor preparado. Próximos passos (deploy/README.md):
  1. Deploy key do GitHub para o usuário petspost (passo 3 do README).
  2. sudo -u petspost bash $HERE/deploy.sh
  3. Apontar o DNS e rodar: sudo certbot --nginx -d ${DOMAIN} -d petspost.com.br -m ${CONTACT} --agree-tos --redirect
MSG
