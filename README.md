# Sakani Closer

Sakani Closer is an internal, AI-enabled WhatsApp property-marketing system for Sakani. This repository currently implements **Phase 1**: the Phase 0 deployment foundation plus owner authentication and server-side workspace authorization. It does not connect WhatsApp, call an AI provider, send messages, or manage leads yet.

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

Edit `.env` before starting services. Replace the PostgreSQL password, Redis password, and `AUTH_SECRET` placeholders with independent, high-entropy URL-safe values. `AUTH_SECRET` must contain at least 32 characters and must not reuse another credential. Never commit `.env`.

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
apps/wa-gateway/   Phase 0 boundary; no WhatsApp connection
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

## Next recommended task

Run browser-level Phase 1 acceptance tests against the Azure VM after deploying the reviewed migration. Do not begin WhatsApp integration until registration, login, logout, inactive membership denial, and cross-workspace isolation are confirmed in that environment.
