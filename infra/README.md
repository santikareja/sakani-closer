# Initial Azure Ubuntu VM Deployment

This is a reproducible Phase 0 deployment path, not an automated production release. Caddy/TLS, monitoring, and automated backup scheduling remain Phase 10 work.

## 1. Prepare access and host

Log in using an SSH key. Never copy the private key into this repository or an agent prompt.

```bash
ssh azureuser@VM_PUBLIC_IP
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
exit
```

Reconnect so Docker group membership is active. Verify `docker version` and `docker compose version` before continuing.

Azure NSG and Ubuntu UFW must allow only the intended public ingress:

- `22/tcp` for SSH, ideally restricted to an administrator IP range.
- `80/tcp` for HTTP when Caddy is introduced.
- `443/tcp` for HTTPS when Caddy is introduced.

Do not add PostgreSQL `5432`, Redis `6379`, or web `3000` to NSG/UFW. This repository does not modify Azure firewall rules.

## 2. Clone and configure

```bash
sudo install -d -o "$USER" -g "$USER" /opt/sakani-closer
git clone REPOSITORY_URL /opt/sakani-closer
cd /opt/sakani-closer
cp .env.example .env
chmod 600 .env
nano .env
```

Replace every `replace-with-...` value. Generate independent, high-entropy URL-safe passwords (letters and digits are sufficient when long) so the same values remain valid in both environment fields and connection URLs.

## 3. Validate, start dependencies, migrate, and seed

```bash
docker compose config --quiet
docker compose pull postgres redis
docker compose up -d postgres redis
docker compose ps
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm seed
```

Do not use `docker compose down -v`; it deletes persistent data.

## 4. Build and start the web service

```bash
docker compose --profile app build web
docker compose --profile app up -d web
docker compose ps
curl --fail --silent http://127.0.0.1:3000/api/health
```

The web port is intentionally loopback-only. Add Caddy in a later hardening phase before exposing the dashboard externally.

## 5. Operational checks

```bash
docker compose logs --tail=100 web postgres redis
df -h
free -h
docker system df
```

Do not print the full environment or connection URLs in shared logs.

## Backup and restore placeholder

Phase 0 documents the process but does not schedule backups. Store backups outside the Git working tree on encrypted, access-controlled storage.

Example logical backup from the VM:

```bash
install -d -m 700 "$HOME/sakani-backups"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "$HOME/sakani-backups/sakani-$(date +%Y%m%d-%H%M%S).dump"
```

A restore overwrites or merges data and must not be improvised. Test it first on a separate database/container, verify checksums and migration compatibility, then schedule a maintenance window. WhatsApp session backup is not applicable until the gateway exists.

## Simple rollback

1. Record the current commit with `git rev-parse HEAD` before deployment.
2. If only the web image fails, switch to the previously recorded application commit, rebuild `web`, and run the health check.
3. Never roll database migrations backward automatically. Use a reviewed forward-fix migration unless a tested restore procedure has been approved.
4. Keep PostgreSQL and Redis volumes in place during application rollback.

```bash
git fetch --all --prune
git switch --detach PREVIOUS_KNOWN_GOOD_COMMIT
docker compose --profile app build web
docker compose --profile app up -d web
curl --fail http://127.0.0.1:3000/api/health
```
