# WhatsApp Gateway — Phase 2B

This service supports owner-controlled QR login for one account through an authenticated web proxy. At startup it reconnects only when the encrypted auth store contains `registered: true`; otherwise it stays `disconnected` and does not create QR. It exposes no send-message capability and does not subscribe to incoming messages.

## Baileys version

`@whiskeysockets/baileys` is pinned exactly to `7.0.0-rc14`. Phase 2B uses `makeWASocket`, a custom `AuthenticationState`/`SignalKeyStore`, `creds.update`, and `connection.update`. It intentionally does not use `useMultiFileAuthState`, terminal QR printing, or pairing codes.

Baileys is an unofficial WhatsApp Web client and this version is a release candidate. Protocol changes or account restrictions can occur without notice. Use a dedicated backup/test number for future manual validation.

## State machine

States are `disconnected`, `connecting`, `qr_ready`, `connected`, `logged_out`, `auth_error`, `transient_error`, and `stopping`. A registered startup session transitions `disconnected/service_started` → `connecting/service_started` → `connected/connection_opened`. An owner disconnect ends at `disconnected/explicit_disconnect`. Every state change has a controlled reason and ISO timestamp. Raw Baileys errors, phone numbers, auth state, and QR payloads never enter the state snapshot.

`logged_out` and `auth_error` do not retry. A confirmed WhatsApp logout deletes that account's invalid encrypted auth records so the next explicit Connect can produce a fresh QR. `transient_error` retries at most five times with capped exponential backoff from 1 to 30 seconds, then remains `transient_error` with reason `retry_exhausted`. An explicit disconnect cancels pending retries and closes the local socket without calling Baileys logout, so valid encrypted credentials remain available for a later explicit Connect.

## Authentication persistence

The `AuthStore` abstraction provides `read`, `write`, `delete`, `list`, and `flush`. The current file adapter hashes logical keys for filenames, serializes Baileys buffers safely, and encrypts the logical key plus value using AES-256-GCM with a unique 96-bit IV for every write. A 32-byte base64url key and a 64-character hexadecimal key are decoded directly; other high-entropy secrets are domain-separated and normalized with SHA-256. It uses authenticated tags and atomic rename; tampering or a wrong key is rejected. The same encrypted account namespace stores the reconnect intent: missing means backward-compatible auto-reconnect, explicit Disconnect writes `false`, and manual Connect writes `true`.

The adapter is suitable for the private Phase 2A single-instance volume, but it is not production-ready for horizontal replicas, remote KMS/HSM key custody, distributed locking, or automated encrypted backups.

## Internal API

- `GET /health` — token-free internal health; healthy even while disconnected.
- `GET /internal/status` — sanitized state plus a masked phone number only while connected.
- `POST /internal/connect` — explicit connection request; empty JSON body only.
- `POST /internal/disconnect` — close the local socket; empty JSON body only.
- `GET /internal/qr` — current unexpired QR; never auth state.

Every `/internal/*` request requires `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>`. Connect and QR endpoints have in-memory fixed-window limits. Responses use `Cache-Control: no-store`, safe stable codes, and Indonesian messages. Port `3001` is not published to the host by Compose.

## Environment

- `WA_GATEWAY_PORT` — defaults to `3001`.
- `WA_AUTH_DATA_DIR` — defaults to `./wa-auth`; Compose uses `/var/lib/sakani-wa`.
- `WA_LOG_LEVEL` — defaults to `info`.
- `INTERNAL_SERVICE_TOKEN` — required, at least 32 characters, no default.
- `SESSION_ENCRYPTION_KEY` — required, 32–1024 high-entropy characters, no default. The recommended value is 32 random bytes encoded as unpadded base64url.

`WA_GATEWAY_URL` belongs to trusted caller services, not to the gateway itself. The gateway has no database or Redis configuration.

The owner-facing routes are `/api/v1/whatsapp/status`, `/connect`, `/disconnect`, `/qr`, and `/refresh`. They require the existing web session; mutations also enforce same-origin requests. Refresh explicitly closes the current socket and starts a new connection attempt.

## Operational limits

- No connection has been validated until the owner approves and performs a manual QR scan with a dedicated test number.
- Registered credentials reconnect automatically across ordinary restarts; missing credentials remain disconnected and do not generate QR.
- No incoming chat storage, media processing, groups, broadcasts, cold outreach, bulk send, or message sending exists.
- A future sending phase must add a kill switch before exposing any send boundary.
