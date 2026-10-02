# Phase 4 WhatsApp Lifecycle and History Runbook

Last verified against the repository on 2026-10-02.

## Safety boundary

The WhatsApp gateway is receive-only. It does not send messages, relay messages, publish presence, auto-reply, broadcast, or trigger follow-up automation. Do not delete or recreate `postgres_data`, `redis_data`, `wa_auth_data`, `caddy_data`, or `caddy_config`. Never use `docker compose down -v` for deployment or rollback.

Phase 4 does not add a database migration. The approved migration set remains `0000`, `0001`, and `0002`; migration `0002` and the Drizzle journal must remain byte-for-byte unchanged.

## State model

The public WhatsApp status keeps four independent concerns:

- `connection`: live gateway state normalized to `connected | connecting | disconnected | unknown`, with a safe gateway detail when available.
- `binding`: whether the gateway's validated encrypted workspace/account binding matches the authenticated workspace. The public value is only `{ state: "bound" | "unbound" | "unknown" }`; workspace and account IDs remain server-side/internal.
- `account`: the durable `wa_accounts` row for `gateway_account_id = default`, including its status and safe timestamps.
- `history`: `available | limited | unavailable`, with safe progress metadata when Baileys emits it.

The gateway serializes lifecycle writes. Its generation guard rejects callbacks from an older socket, so a stale close callback cannot be queued after a newer open. The web repository updates only the bound row selected by `workspace_id`, account ID, and `gateway_account_id = default`.

On open, the repository writes `status = connected`, `last_connected_at`, `updated_at`, and an optional masked identifier. It does not overwrite `last_disconnected_at`. On close or explicit disconnect, it writes `status = disconnected`, `last_disconnected_at`, and `updated_at` without overwriting `last_connected_at`.

## History capability and limitations

The installed dependency is `@whiskeysockets/baileys@7.0.0-rc14`. It exposes `messaging-history.set`, `syncFullHistory`, `shouldSyncHistoryMessage`, and `fetchMessageHistory`. The socket advertises desktop full-history capability and accepts supported history notifications.

An established linked-device session is not guaranteed to emit history on an ordinary reconnect. Status therefore begins as `limited` and becomes `available` only after the gateway receives a history event. Phase 4 does not expose `fetchMessageHistory`, because it requires a trusted chat boundary key and timestamp that the current product contract does not provide. It also never resets auth, deletes the auth volume, or loops reconnects to force history.

History and realtime events share one normalizer. History is processed in chunks of 25, with at most eight queued tasks and at most 5,000 messages accepted from one provider event. Oversized or backpressured work emits a safe `wa.history.failed` diagnostic. Provider-message uniqueness in PostgreSQL remains the final idempotency boundary.

## Public and internal routing

Caddy serves `app.sakani.id`, performs automatic HTTP-to-HTTPS redirects, and proxies normal traffic to `web:3000`. It returns `404` for `/api/v1/internal/*` before proxying. The gateway is not proxied publicly and has no host port.

The gateway reaches internal web routes directly over Docker networking:

- `POST http://web:3000/api/v1/internal/whatsapp/messages`
- `POST http://web:3000/api/v1/internal/whatsapp/lifecycle`

Both routes require `INTERNAL_SERVICE_TOKEN` and validate their payloads with Zod. Caddy's admin API is disabled and port `2019` is not published. PostgreSQL and Redis remain loopback-only.

## Pre-deployment checks

Run from the repository root without printing environment values:

Compose intentionally retains `APP_URL: ${APP_URL:-http://localhost:3000}` as its local fallback. The Azure VM `.env` must explicitly set `APP_URL=https://app.sakani.id`; do not rely on the fallback in production.

```sh
test -n "$AUTH_SECRET"
test -n "$SESSION_ENCRYPTION_KEY"
test -n "$INTERNAL_SERVICE_TOKEN"
test -n "$DATABASE_URL"
test -n "$REDIS_URL"
test "$APP_URL" = "https://app.sakani.id"
test "$WA_GATEWAY_URL" = "http://wa-gateway:3001"

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit
git diff --check

pnpm --filter @sakani/database db:assert-migrations
pnpm --filter @sakani/database db:verify-schema
docker compose --profile app config --quiet
docker run --rm -v "$PWD/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2.10.2-alpine caddy validate --config /etc/caddy/Caddyfile
```

Only run the PostgreSQL integration test when `DATABASE_INTEGRATION_URL` is present and its database name contains `test`:

```sh
pnpm test:database-integration
```

Do not substitute `DATABASE_URL` for that test variable.

## Deployment commands

Deployment is a deliberate operator action on the Azure VM. Record the current image tag and Git revision first.

```sh
git status --short
git rev-parse HEAD
docker compose --profile app config --quiet
docker compose --profile app build web wa-gateway
docker compose --profile app up -d --no-deps web wa-gateway caddy
docker compose --profile app ps
```

No database migration is introduced by this phase. If the normal release procedure always verifies migration artifacts, run the read-only/assertion step and the existing idempotent migration container without deleting any volume:

```sh
docker compose --profile tools run --rm migrate
```

## Read-only verification

```sh
curl -fsS https://app.sakani.id/api/health
curl -sS -o /dev/null -w '%{http_code}\n' https://app.sakani.id/api/v1/internal/whatsapp/messages
curl -sS -o /dev/null -w '%{http_code}\n' http://app.sakani.id/api/health
docker compose --profile app ps
docker compose --profile app logs --since=10m web wa-gateway caddy
```

Expected results:

- health is successful over HTTPS;
- the public internal path returns `404`;
- HTTP redirects to HTTPS;
- no secrets, raw JIDs, QR values, auth state, or full message text appear in logs.

From the authenticated owner UI, verify login, status, binding, and durable account state. Send exactly one inbound test message without replying. Confirm one row is created, replay the same provider ID through the controlled integration fixture, and confirm the row count remains unchanged. Restart only the gateway with `docker compose --profile app restart wa-gateway`, then verify the encrypted binding remains bound and the durable account returns to connected after socket open.

For internal network reachability without creating a message, execute a schema-invalid request from the gateway container. A `400` response confirms authenticated routing; `401` means token mismatch, and connection failure means network or web health trouble. The command must not print the token:

```sh
docker compose --profile app exec wa-gateway node -e "fetch('http://web:3000/api/v1/internal/whatsapp/messages',{method:'POST',headers:{authorization:'Bearer '+process.env.INTERNAL_SERVICE_TOKEN,'content-type':'application/json'},body:'{}'}).then(r=>console.log(r.status)).catch(()=>process.exit(1))"
```

## Diagnostics

- `account_unbound`: the encrypted binding is absent or invalid. Use the authenticated owner Connect flow; do not write workspace/account IDs manually.
- `account_status_stale`: compare runtime connection, binding, durable account, and `diagnostics.lifecyclePersistence`. A failed lifecycle diagnostic indicates the gateway could not reach or persist through the web service.
- `history_unavailable`: `unavailable` means the running connector has no history pipeline; `limited` means support exists but this session has not emitted history. Do not reset auth to force it.
- `ingest_failed`: inspect web/gateway health, the private route, token consistency by presence/length only, and retry diagnostics. Do not log or replay raw customer payloads.
- `duplicate`: expected idempotent handling for an existing workspace/account/provider message ID.
- `gateway_unhealthy`: inspect container health, safe connection reason, Redis/database health, and recent redacted logs.

Public registration remains enabled by the existing `/api/auth/register` contract. Phase 4 does not silently disable it; production policy for open registration remains an explicit owner/security decision.

## Rollback

Rollback application and proxy code to the previously recorded image tag or Git revision. Do not roll back the database because this phase has no migration.

In a clean deployment checkout, revert the Phase 4 commit or select the previously approved immutable image tag:

```sh
git revert <phase4-commit>
docker compose --profile app config --quiet
docker compose --profile app build web wa-gateway
docker compose --profile app up -d --no-deps web wa-gateway caddy
docker compose --profile app ps
```

If deployment uses immutable tagged images, restore the previous `SAKANI_IMAGE_TAG` and run the equivalent `docker compose up -d --no-deps` command. Never remove named volumes, never delete the WhatsApp auth directory, and never change secrets as a rollback shortcut.
