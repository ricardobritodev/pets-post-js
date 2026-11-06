# Deploy no VPS da Hostinger

Decisão: [Q-004](../todo/00-pendencias.md), um VPS com Ubuntu 24.04, com Nginx, Node e MySQL na mesma máquina.
Fotos em disco (ADR 006). O Flask foi aposentado: se algo der errado, voltamos para a **versão anterior da v2**.

```
www.petspost.com.br ──DNS──> VPS
  Nginx (HTTPS, Let's Encrypt) ──> Node :3000 (systemd "petspost") ──> MySQL (só localhost)
                                   └─ /var/lib/petspost/uploads (fotos)
  /srv/petspost/releases/<data>   versões publicadas; /srv/petspost/current aponta para a ativa
  /etc/petspost/petspost.env      senhas e configuração (criado pelo setup, nunca vai para o git)
  /var/backups/petspost           backup diário (banco + fotos, 14 dias)
```

| Arquivo | Para quê |
|---|---|
| `setup-server.sh` | prepara o VPS novo (uma vez) |
| `deploy.sh` | publica a `main` ou uma tag; volta sozinho se a versão nova não subir |
| `rollback.sh` | volta para a versão anterior |
| `backup.sh` | backup diário (instalado no cron pelo setup) |
| `petspost.service` | serviço do systemd |
| `nginx-petspost.conf` | proxy reverso; `petspost.com.br` → `www.petspost.com.br` |

## 1. Contratar o VPS
1. Hostinger → VPS → **KVM 1** (1 vCPU, 4 GB) ou maior. O preço de promoção exige contrato longo, então
   confira o valor da renovação.
2. Sistema: **Ubuntu 24.04** "limpo" (sem painel nem template de aplicação).
3. Cadastre a sua **chave SSH** no painel da Hostinger (`cat ~/.ssh/id_ed25519.pub` no seu computador; se não
   tiver, crie com `ssh-keygen -t ed25519`).
4. Anote o **IP** do VPS.

## 2. Preparar o servidor
```bash
ssh root@IP_DO_VPS
git clone https://github.com/ricardobritodev/pets-post-js.git /tmp/petspost   # pede login (repo privado)
sudo bash /tmp/petspost/deploy/setup-server.sh git@github.com:ricardobritodev/pets-post-js.git SEU_EMAIL
```
O script instala Nginx, MySQL, Node 26, certbot, firewall (só 22, 80 e 443) e fail2ban. Ele também cria o
banco com uma senha aleatória e grava `/etc/petspost/petspost.env`.

> Para clonar o repo privado só nesse primeiro passo, use um token pessoal do GitHub (Settings → Developer
> settings → Personal access tokens, só leitura). Depois apague o `/tmp/petspost`.

## 3. Deploy key (o servidor lê o repo sem a sua senha)
```bash
sudo -u petspost ssh-keygen -t ed25519 -N "" -f /srv/petspost/.ssh/id_ed25519
sudo cat /srv/petspost/.ssh/id_ed25519.pub
```
Cole a chave em GitHub → repositório → Settings → **Deploy keys** → Add (sem "write access"). Depois:
```bash
sudo -u petspost ssh -o StrictHostKeyChecking=accept-new -T git@github.com   # responde "successfully authenticated"
```

## 4. Primeiro deploy
```bash
sudo -u petspost bash /tmp/petspost/deploy/deploy.sh
```
Teste pelo IP: `curl http://IP_DO_VPS/api/v1/health/db` → `{"status":"ok","db":"up"}`.

Crie o admin e os parceiros:
```bash
sudo -u petspost bash -c 'set -a; source /etc/petspost/petspost.env; cd /srv/petspost/current &&
  npm run admin:create -w @petspost/api -- --email SEU_EMAIL --name "Seu Nome" &&
  npm run db:seed:partners'
```

## 5. Domínio e HTTPS
1. Onde o domínio foi registrado (normalmente o **Registro.br** para `.com.br`):
   - Se o DNS ainda aponta para a hospedagem antiga (Integrator), troque para "Utilizar os servidores DNS do
     Registro.br" (ou mantenha o DNS onde estiver, desde que você consiga editar os registros).
   - Crie os registros **A**: `petspost.com.br` → IP do VPS e `www.petspost.com.br` → IP do VPS.
     Se o VPS tiver IPv6, crie também os **AAAA**.
2. Espere propagar (`dig +short www.petspost.com.br` mostra o IP novo; pode levar de minutos a algumas horas).
3. Certificado:
   ```bash
   sudo certbot --nginx -d www.petspost.com.br -d petspost.com.br -m SEU_EMAIL --agree-tos --redirect
   ```
   A renovação é automática (timer do certbot).

## 6. Testes de fumaça (depois de cada deploy)
- [ ] `https://www.petspost.com.br` abre com o cadeado
- [ ] `http://petspost.com.br/posts/1` → redireciona para `https://www.petspost.com.br/posts/1`
- [ ] cadastro, login e logout
- [ ] publicar um anúncio com foto, abrir o detalhe e ver o mapa (a geocodificação leva alguns segundos)
- [ ] colar o link de um anúncio no WhatsApp e ver a prévia (título e foto)
- [ ] `/mapa` e "Minha localização"
- [ ] `/admin` com o admin criado no passo 4

## Dia a dia
| Tarefa | Comando |
|---|---|
| Publicar a `main` | `sudo -u petspost bash /srv/petspost/current/deploy/deploy.sh` |
| Publicar uma tag | `... deploy.sh v1.0.0` |
| Voltar para a versão anterior | `sudo -u petspost bash /srv/petspost/current/deploy/rollback.sh` |
| Ver logs | `journalctl -u petspost -f` |
| Status | `systemctl status petspost` |
| Backup na hora | `sudo /usr/local/bin/petspost-backup` |

## Backup
- Todo dia às 3h vão para `/var/backups/petspost` o dump do banco e as fotos, guardados por 14 dias.
- **Copie para fora do VPS** de vez em quando (se o VPS se perder, o backup vai junto):
  ```bash
  scp 'root@IP_DO_VPS:/var/backups/petspost/*' ./backups-petspost/
  ```
  O painel da Hostinger também tem snapshots do VPS, uma segunda camada.

### Restaurar backup
```bash
sudo systemctl stop petspost
gunzip -c /var/backups/petspost/db-AAAAMMDD-HHMMSS.sql.gz | sudo mysql petspost
sudo tar -xzf /var/backups/petspost/uploads-AAAAMMDD-HHMMSS.tar.gz -C /var/lib/petspost
sudo chown -R petspost:petspost /var/lib/petspost/uploads
sudo systemctl start petspost
```

## Problemas comuns
| Sintoma | Causa / solução |
|---|---|
| 502 Bad Gateway | o Node caiu: `journalctl -u petspost -n 50` (geralmente variável faltando no `.env`) |
| `Configuração inválida` no log | `/etc/petspost/petspost.env` sem `DATABASE_URL` ou com `SESSION_SECRET` curto |
| Login não "pega" (volta deslogado) | acessando por `http://`: o cookie de sessão em produção só vai por HTTPS. Use o domínio com certificado |
| Foto grande dá erro 413 sem mensagem | `client_max_body_size` do Nginx menor que 8 MB |
| Mapa sem os tiles | firewall de saída ou `img-src` do CSP alterado; o OpenStreetMap exige o `Referer` |
| Anúncios antigos sem mapa | `npm run geo:backfill -w @petspost/api -- --apply` (com o `.env` carregado, como no passo 4) |
