# Phase 4 Current State

Date: 2026-10-02

## Current lifecycle path

- `ConnectionManager` owns the runtime state machine, retry policy, QR lifecycle, and stale-callback generation guard.
- `BaileysConnector` emits `onOpen` only after credential persistence has flushed and emits `onClose` after classifying the disconnect.
- Runtime open/close events are logged safely, but they are not persisted to `wa_accounts`.
- `wa_accounts.status` is currently changed to `connected` only as a side effect of accepted inbound-message ingestion. A connected socket can therefore coexist with a durable `disconnected` row.
- Explicit disconnect stops the socket and reconnect intent, but does not persist `last_disconnected_at`.

## Current binding path

- The owner-only web mutation resolves `workspaceId` from the authenticated server session and upserts the single `gateway_account_id = default` account.
- The web service sends the validated workspace/account binding to the private gateway route.
- `AccountBindingStore` validates the binding with Zod, encrypts it through the existing auth store, flushes it, and keeps a memory copy.
- The gateway status currently reports only `bound | unbound`; the public web status does not query the durable account row.

## Current ingestion path

- `BaileysConnector` listens to `messages.upsert` only.
- `normalizeInboundMessage` filters groups, broadcasts, status/newsletter-like unsupported JIDs, owner-originated messages, and unsupported content. It supports PN JIDs and hashes LID identifiers without treating a LID as a phone number.
- `HttpInboundEventSink` posts versioned, bound events to `POST /api/v1/internal/whatsapp/messages` with the internal bearer token and retries transient failures.
- The web handler validates the full payload with Zod and validates the encrypted binding against the workspace-scoped `wa_accounts` row whose gateway account is `default`.
- The repository transaction creates or updates the contact/conversation/message/media metadata. Provider-message uniqueness is scoped by workspace and account.
- The current sink starts one promise per message and has no bounded queue. Historical `append` upserts are deliberately ignored, and `messaging-history.set` is not handled.

## Installed Baileys capability

- Installed and resolved version: `@whiskeysockets/baileys@7.0.0-rc14`.
- The installed types expose `messaging-history.set`, `messaging-history.status`, `syncFullHistory`, `shouldSyncHistoryMessage`, `fetchMessageHistory`, `remoteJidAlt`, and LID/PN mappings.
- Full history can be requested for device synchronization, but an already established session is not guaranteed to emit historical chunks on an ordinary reconnect. No auth reset or forced re-pair is acceptable.

## Current Caddy path

- No `Caddyfile` or Compose override is tracked in the repository.
- The current Compose file publishes the web service only on loopback and keeps the gateway internal without a host port.
- PostgreSQL and Redis are bound to loopback only.
- Production Caddy behavior is therefore not reproducible from this checkout, and no repository policy currently blocks `/api/v1/internal/*` at the public proxy boundary.

## Missing behavior

- Persist bound open/close lifecycle events to the existing `wa_accounts` columns.
- Keep stale socket callbacks and reordered lifecycle writes from overwriting a newer state.
- Separate runtime connection, encrypted binding, durable account state, history capability, and lifecycle-persistence diagnostics in status responses.
- Consume history chunks through the same normalizer as realtime messages with bounded processing, retry, and shutdown flush.
- Track history progress honestly and keep established-session capability `limited` until history is observed.
- Commit reproducible Caddy configuration with public internal-route blocking and no gateway/database/Redis proxy.
- Add Phase 4 deployment and rollback documentation.

## Files proposed to change

- Gateway connection, message pipeline, internal status, startup wiring, configuration, and focused tests under `apps/wa-gateway`.
- Web WhatsApp contracts, route handlers/runtime, repositories, new internal lifecycle route, adapters, and focused tests under `apps/web`.
- Shared versioned internal event types in `packages/shared`.
- Environment validation in `packages/config` only for non-secret lifecycle/history settings.
- `docker-compose.yml`, new `Caddyfile`, and Phase 4 documentation.
- `docs/frontend-backend-contract.md` because the public WhatsApp status DTO will gain durable account and history fields.

## Files explicitly not changed

- `packages/database/drizzle/0000_dry_anthem.sql`
- `packages/database/drizzle/0001_youthful_captain_america.sql`
- `packages/database/drizzle/0002_productive_kinsey_walden.sql`
- `packages/database/drizzle/meta/*`
- Database schema definitions and production data
- Auth/session secrets, WhatsApp auth state, and named data volumes
- Outbound WhatsApp, AI, automation, broadcast, and follow-up code
- Existing frontend visual structure outside the status adapter/contract fields required by this phase
