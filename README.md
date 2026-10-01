# Sakani Closer

Sakani Closer is an internal, AI-enabled WhatsApp property-marketing system for Sakani. This repository currently implements **Batch 1 receive-only ingestion** on top of Phase 0, Phase 1, and Phase 2B. A registered WhatsApp session reconnects after restart, direct inbound text/image/document metadata is stored idempotently, and an authenticated owner can read it at `/dashboard/inbox`. No message-send path, AI call, RAG, or follow-up automation is enabled.

## Phase 0 status

Included:

- pnpm TypeScript workspace with strict compiler settings.
- Minimal Next.js App Router application at `/`, `/health`, and `/api/health`.
- PostgreSQL + pgvector and Redis Compose services with persistent named volumes.
- Drizzle schema, committed migration, and idempotent Sakani/pipeline seed.
- Environment validation, structured redacted logging, tests, linting, formatting, and type checks.
- Initial Azure Ubuntu VM runbook and security policy.
- Placeholder boundaries for the WhatsApp gateway, worker, and AI model contracts.

Not included in Phase 0: authentication, Baileys login, inbox, CRM, AI calls, RAG, catalog, skills, memory, follow-up jobs, public HTTPS, or production monitoring.

## Phase 1 status

Included:

- Owner registration and login with Argon2id password hashing.
- Opaque encrypted session cookies backed by hashed database session tokens.
- Active membership checks and server-side workspace authorization.
- Protected `/dashboard` page with the active owner, workspace, and Phase 0 health status.
- Redis-backed login rate limiting, same-origin mutation checks, and safe redirects.
- Workspace-scoped audit events for successful login, relevant failed login, registration, and logout.

Still not included: Baileys login, inbox, CRM workflows, AI calls, RAG, catalog management, skills, memory, follow-up jobs, billing, public HTTPS, or production deployment automation.

## Phase 2A status

Included:

- A separate `wa-gateway` Node.js service using pinned `@whiskeysockets/baileys` `7.0.0-rc14`.
- An explicit connection state machine and manual internal connect/disconnect boundaries.
- In-memory, expiring QR state that is never returned by health/status and is never logged.
- AES-256-GCM encrypted Baileys credential/key persistence in a private named volume.
- Bearer-authenticated internal routes, fixed-window rate limits, safe errors, and an unauthenticated internal health route.
- A Compose service with no host port, no PostgreSQL/Redis dependency, and no startup auto-connect.

Not included in Phase 2A: owner-facing QR proxy/UI, production WhatsApp login validation, incoming message processing, message sending, groups, broadcasts, pairing codes, AI, RAG, CRM automation, media processing, or follow-up jobs. Do not claim the gateway is connected until the next slice exposes the QR through the authenticated web backend and validates it with a dedicated test number.

## Phase 2B status

Included:

- Protected owner page at `/dashboard/settings/whatsapp` with explicit connect, expiring QR, refresh, status, masked phone number, and explicit disconnect controls.
- Authenticated same-origin web API that proxies to the private gateway with a server-only internal token.
- Encrypted Baileys session recovery from the private named volume across process/container restarts.
- Automatic startup reconnect only when encrypted credentials contain a registered session; a fresh installation remains disconnected without creating QR.
- Logged-out/authentication failure terminal states and bounded transient reconnect with exponential backoff.
- QR data kept only in gateway/browser memory until expiry; it is not stored in URLs, browser storage, logs, or the database.

Still not included: incoming message processing, sending, groups, broadcasts, pairing codes, AI, RAG, CRM, media, or follow-up automation.

## Batch 1 receive-only status

Included:

- `messages.upsert` normalization for private text, extended text, image metadata, and document metadata.
- Explicit filtering of groups, broadcasts, status, unsupported JIDs/content, historical append events, and owner-originated messages.
- Additive workspace-scoped `wa_accounts`, `contacts`, `conversations`, `messages`, and `message_media` tables.
- Database-backed idempotency on workspace, WhatsApp account, and provider message ID.
- A bearer-authenticated gateway-to-web ingestion endpoint; raw Baileys messages and full JIDs never cross this boundary.
- Protected cursor-paginated inbox list/detail APIs and `/dashboard/inbox`.

Still not included: outbound/manual send, auto-reply, AI, RAG, full media download, groups, broadcasts, CRM automation, scoring, or follow-up. Existing Phase 2B sessions need one authenticated **Hubungkan** action after this deployment to bind the encrypted gateway session to the owner workspace; the binding then persists across restarts and reuses the existing session without a QR.

## Prerequisites

- Node.js 22 or newer (Node.js 24 is used by the container image).
- pnpm 10 or newer; the repository pins pnpm `11.1.2` through `packageManager`.
- Docker Engine with Docker Compose v2.
- Git.

On Windows PowerShell, use `pnpm.cmd` if the PowerShell execution policy blocks `pnpm.ps1`.

## Local setup

```bash
git clone REPOSITORY_URL sakani-closer
cd sakani-closer
corepack enable
pnpm install
cp .env.example .env
```

Edit `.env` before starting services. Replace the PostgreSQL password, Redis password, `AUTH_SECRET`, `INTERNAL_SERVICE_TOKEN`, and `SESSION_ENCRYPTION_KEY` placeholders with independent, high-entropy values. Each application secret must contain at least 32 characters. The recommended 32-byte base64url generator is documented in `.env.example`; existing high-entropy 64-character secrets are also accepted and normalized to an AES-256 key. Never commit `.env`.

Environment validation is service-specific: migration and seed commands require only `DATABASE_URL`; the web runtime additionally requires `APP_URL`, `REDIS_URL`, `AUTH_SECRET`, `WA_GATEWAY_URL`, and `INTERNAL_SERVICE_TOKEN`; the gateway requires only its port/log/path settings, ingestion URL, encryption key, and internal token. The worker contract remains separate. Database tools never validate web or gateway secrets.

PowerShell equivalent for the copy step:

```powershell
Copy-Item .env.example .env
```

## Start PostgreSQL and Redis

```bash
docker compose config --quiet
docker compose up -d postgres redis
docker compose ps
```

PostgreSQL and Redis bind only to `127.0.0.1`; they are unavailable from other hosts. Inspect health without printing secrets:

```bash
docker compose exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose exec redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping'
```

## Migration and seed

With Node.js on the host and `.env` loaded into the shell:

```bash
pnpm db:migrate
pnpm db:seed
```

Or run them inside the Compose network, which is the recommended VM path:

```bash
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm seed
```

The seed is repeatable. It upserts the `sakani` workspace and these ordered stages: Baru, Terkualifikasi, Survei, Sudah Survei, Booking, Akad, Closing, and Lost.

To change the Drizzle schema later, edit `packages/database/src/schema.ts`, then generate and review a migration:

```bash
pnpm db:generate
pnpm db:migrate
```

Never use schema push or destructive reset commands against shared data.

Phase 1 migration `0001_youthful_captain_america.sql` is additive. It adds password/status fields, a default workspace pointer, membership status, and the `sessions` table. Existing users are assigned their earliest membership as the default workspace; existing rows are not deleted.

## Run the web application

Load `.env` into the process, then run:

```bash
pnpm dev:web
```

Use `/daftar` to create an owner and isolated workspace, `/login` to sign in, and `/dashboard` for the protected shell. Registration creates the default pipeline stages for the new workspace.

Open `http://localhost:3000`, `http://localhost:3000/health`, or `http://localhost:3000/api/health`. The API returns `200` only when both PostgreSQL and Redis are healthy; otherwise it returns `503`. Responses include status, sanitized environment labels, latency, and timestamp—never credentials or connection strings.

To run the containerized web service:

```bash
docker compose --profile app build web
docker compose --profile app up -d web
curl --fail http://127.0.0.1:3000/api/health
```

## Run the Phase 2B WhatsApp gateway

The gateway loads the encrypted credential record at startup. A registered session reconnects automatically without QR; a missing or unregistered session stays `disconnected` until an authenticated owner uses the web settings page:

```bash
docker compose --profile gateway build wa-gateway
docker compose --profile gateway up -d wa-gateway
docker compose ps wa-gateway
docker compose exec wa-gateway node -e "fetch('http://127.0.0.1:3001/health').then(async r => { console.log(r.status, await r.json()); if (!r.ok) process.exit(1) })"
```

There is no host port for the gateway. Its `gateway_private` bridge permits outbound WhatsApp connectivity and service-to-service access but does not publish port `3001`. `/internal/*` requires `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>`; `/health` is intentionally token-free for the container healthcheck. The browser never receives this internal token. The gateway posts canonical inbound events to the private web endpoint configured by `WA_INGEST_URL`; it has no database credentials.

After both services are healthy, sign in as the owner and open `/dashboard/settings/whatsapp`. Disconnect closes the active socket, preserves the encrypted session, and persists a disabled reconnect intent, so subsequent restarts remain disconnected. A later explicit Connect re-enables startup reconnect and can reuse valid credentials without requesting QR.

See [`apps/wa-gateway/README.md`](apps/wa-gateway/README.md) for the API, state machine, encryption format, current limitations, and operational notes.

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docker:check
```

Unit tests mock dependency boundaries and do not require Docker. The actual migration, seed, and live dependency health checks require running PostgreSQL and Redis.

## Azure Ubuntu VM deployment

Follow [`infra/README.md`](infra/README.md). In summary:

1. SSH with a key and install Docker Engine + Compose.
2. Clone into `/opt/sakani-closer`.
3. Create `.env` manually with mode `600`; never commit it.
4. Validate Compose, start PostgreSQL/Redis, run migration and seed.
5. Build/start the loopback-only web service.
6. Verify `/api/health`, logs, disk, and memory.

There is no automated production deployment in Phase 0.

## Public ports

Azure NSG and UFW should expose only:

- `22/tcp`: SSH, preferably restricted by source IP.
- `80/tcp`: HTTP for a future Caddy redirect/challenge.
- `443/tcp`: HTTPS for a future Caddy endpoint.

Never publicly expose `3000`, `5432`, or `6379`. Current Compose bindings for web, PostgreSQL, and Redis are loopback-only.

## Backup warning

Named volumes are persistent but are not backups. Phase 0 includes a documented `pg_dump` example only; it does not schedule, encrypt, upload, retain, or restore backups automatically. A restore drill must be completed before production usage. Never use `docker compose down -v` in normal operations.

## Repository map

```text
apps/web/          Next.js auth, protected dashboard, and health application
apps/wa-gateway/   QR/session gateway plus receive-only normalization; sending disabled
apps/worker/       Phase 0 boundary; no queue processing
packages/config/   Zod environment contracts
packages/database/ Drizzle schema, migration, seed, and health query
packages/shared/   Small shared result/status types and constants
packages/ai/       Provider/model interfaces only
packages/logger/   Pino logger with redaction and correlation context
infra/             Azure VM and operations guidance
docs/              Scope assumptions and PRD notes
```

## Phase 1 deployment and rollback

Before deployment, create a protected database backup and generate a new `AUTH_SECRET`. Pull the code, update `.env`, run `pnpm install --frozen-lockfile`, review and run `pnpm db:migrate`, rebuild the web image, then verify `/api/health`, registration, login, dashboard access, and logout.

Rollback should restore the pre-Phase-1 database backup and deploy the previous application revision together. The migration is additive, but dropping auth columns or `sessions` manually is not recommended because that makes rollback dependent on unknown post-migration account data.

## Phase 2B deployment and rollback

Deploy with `git pull --ff-only origin main`, validate Compose, rebuild `wa-gateway` and `web` without cache, and start `postgres redis web wa-gateway`. Verify both health endpoints and confirm `docker compose port wa-gateway 3001` prints no host binding. Internal status checks must run from the web/gateway Compose network and pass the token without printing it.

Rollback by stopping only `web` and `wa-gateway`, deploying the pre-Phase-2B application revision, and rebuilding those two services. Do not remove `wa_auth_data`, database volumes, or the database. If the session encryption key changes, restore the matching protected key and encrypted auth-volume backup together.

## Batch 1 deployment and rollback

Create a protected PostgreSQL backup, review `0002_productive_kinsey_walden.sql`, and run the committed migration with the tools profile. Rebuild `web` and `wa-gateway`, start both services, sign in, and press **Hubungkan** once to persist the workspace/account binding for an existing Phase 2B session. Send one direct test message, confirm exactly one inbox row, and confirm the WhatsApp test number sends no reply.

For application rollback, deploy the previous revision and rebuild only `web` and `wa-gateway`. The Batch 1 migration is additive, so its empty or retained tables can remain for the old application. Restore the database backup only when explicitly required; never remove `postgres_data` or `wa_auth_data`, and never use `docker compose down -v`.
