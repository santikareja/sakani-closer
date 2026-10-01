# WhatsApp Gateway - Batch 1 receive-only

This service supports owner-controlled QR login for one account through an authenticated web proxy and receive-only private-message normalization. At startup it reconnects only when encrypted auth state identifies a registered account and reconnect intent remains enabled; otherwise it stays disconnected without creating QR. It exposes no send-message capability. `messages.upsert` events become canonical internal DTOs and are posted to the private web ingestion endpoint; raw messages and full JIDs are not persisted.

## Baileys version

`@whiskeysockets/baileys` is pinned exactly to `7.0.0-rc14`. The gateway uses `makeWASocket`, a custom `AuthenticationState`/`SignalKeyStore`, `creds.update`, `connection.update`, and `messages.upsert`. It intentionally does not use `useMultiFileAuthState`, terminal QR printing, pairing codes, media download, or any sending API.

Baileys is an unofficial WhatsApp Web client and this version is a release candidate. Protocol changes or account restrictions can occur without notice. Use a dedicated backup/test number for manual validation.

## State machine

States are `disconnected`, `connecting`, `qr_ready`, `connected`, `logged_out`, `auth_error`, `transient_error`, and `stopping`. A registered startup session transitions `disconnected/service_started` -> `connecting/service_started` -> `connected/connection_opened`. An owner disconnect ends at `disconnected/explicit_disconnect`. Every state change has a controlled reason and ISO timestamp. Raw Baileys errors, phone numbers, auth state, QR payloads, JIDs, and message text never enter state or connection logs.

`logged_out` and `auth_error` do not retry. A confirmed WhatsApp logout deletes that account's invalid encrypted auth records so the next explicit Connect can produce a fresh QR. `transient_error` retries at most five times with capped exponential backoff from 1 to 30 seconds, then remains `transient_error` with reason `retry_exhausted`. An explicit disconnect cancels pending retries and closes the local socket without calling Baileys logout, so valid encrypted credentials remain available for a later explicit Connect.

## Authentication and binding persistence

The `AuthStore` abstraction provides `read`, `write`, `delete`, `list`, and `flush`. The file adapter hashes logical keys, serializes Baileys buffers safely, and encrypts each value using AES-256-GCM with a unique 96-bit IV. Authenticated tags are verified on read and writes use atomic rename.

The same encrypted volume stores reconnect intent and the server-derived workspace/account binding. Existing Phase 2B installations need one authenticated Connect after Batch 1 deployment; that idempotent call persists the binding while reusing the registered session without a QR. The binding survives subsequent process/container restarts.

The adapter is suitable for the private single-instance volume, but not for horizontal replicas, remote KMS/HSM custody, distributed locking, or automated encrypted backups.

## Internal API

- `GET /health` - token-free internal health; healthy even while disconnected.
- `GET /internal/status` - sanitized state plus a masked phone number only while connected.
- `POST /internal/connect` - explicit connection request with a server-derived workspace/account UUID binding.
- `POST /internal/disconnect` - close the local socket; empty JSON body only.
- `GET /internal/qr` - current unexpired QR; never auth state.

Every `/internal/*` request requires `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>`. Connect and QR endpoints have in-memory fixed-window limits. Responses use `Cache-Control: no-store`, stable safe codes, and Indonesian messages. Port `3001` is not published to the host by Compose.

## Inbound policy

- Accept `notify` events for private PN or LID chats.
- Normalize conversation text, extended text, image metadata, and document metadata.
- Ignore groups, broadcasts, status, unsupported JIDs/content, historical append events, and `fromMe` messages.
- HMAC-hash the chat JID and mask a PN when one is available.
- Never persist or transmit raw `WAMessage` JSON or media bytes.
- Retry internal delivery at most three times; database uniqueness remains the final idempotency guard.
- Never call `sendMessage` or expose any send route.

## Environment

- `WA_GATEWAY_PORT` - defaults to `3001`.
- `WA_AUTH_DATA_DIR` - defaults to `./wa-auth`; Compose uses `/var/lib/sakani-wa`.
- `WA_LOG_LEVEL` - defaults to `info`.
- `INTERNAL_SERVICE_TOKEN` - required, at least 32 characters, no default.
- `SESSION_ENCRYPTION_KEY` - required, 32-1024 high-entropy characters, no default.
- `WA_INGEST_URL` - required private web ingestion endpoint.

`WA_GATEWAY_URL` belongs to trusted caller services, not to the gateway itself. `WA_INGEST_URL` points in the reverse direction to the authenticated private web endpoint. The gateway has no database or Redis configuration.

## Operational limits

- Registered credentials reconnect across ordinary restarts; missing credentials remain disconnected and do not generate QR.
- Direct inbound text plus image/document metadata can be stored; media bytes are not downloaded.
- Groups, broadcasts, status, owner-originated messages, cold outreach, bulk send, and all message sending remain disabled.
- A future sending phase must add a kill switch, opt-out enforcement, rate limits, and human takeover before exposing any send boundary.
