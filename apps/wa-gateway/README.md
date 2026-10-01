# WhatsApp Gateway — Phase 2A

This service is an isolated Baileys connection skeleton. It starts an internal HTTP server in `disconnected` state and never connects to WhatsApp automatically. It exposes no send-message capability and does not subscribe to incoming messages.

## Baileys version

`@whiskeysockets/baileys` is pinned exactly to `7.0.0-rc14`. Phase 2A uses `makeWASocket`, a custom `AuthenticationState`/`SignalKeyStore`, `creds.update`, and `connection.update`. It intentionally does not use `useMultiFileAuthState`, terminal QR printing, or pairing codes.

Baileys is an unofficial WhatsApp Web client and this version is a release candidate. Protocol changes or account restrictions can occur without notice. Use a dedicated backup/test number for future manual validation.

## State machine

States are `disconnected`, `connecting`, `qr_ready`, `connected`, `logged_out`, `auth_error`, `transient_error`, and `stopping`. Every state change has a controlled reason and ISO timestamp. Raw Baileys errors, phone numbers, auth state, and QR payloads never enter the state snapshot.

`logged_out` and `auth_error` do not retry. `transient_error` retries with capped exponential backoff from 1 to 30 seconds. An explicit disconnect cancels pending retries and closes the local socket without calling Baileys logout.

## Authentication persistence

The `AuthStore` abstraction provides `read`, `write`, `delete`, and `list`. The current file adapter hashes logical keys for filenames, serializes Baileys buffers safely, and encrypts the logical key plus value using AES-256-GCM with a unique 96-bit IV for every write. A 32-byte base64url key and a 64-character hexadecimal key are decoded directly; other high-entropy secrets are domain-separated and normalized with SHA-256. It uses authenticated tags and atomic rename; tampering or a wrong key is rejected.

The adapter is suitable for the private Phase 2A single-instance volume, but it is not production-ready for horizontal replicas, remote KMS/HSM key custody, distributed locking, or automated encrypted backups.

## Internal API

- `GET /health` — token-free internal health; healthy even while disconnected.
- `GET /internal/status` — sanitized state only.
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

## Operational limits

- No public QR endpoint or owner-facing proxy exists yet.
- No connection has been validated until the next slice performs a manual QR scan with a test number.
- Credentials persist across ordinary restarts through the private volume, but startup remains disconnected by policy.
- No incoming chat storage, media processing, groups, broadcasts, cold outreach, bulk send, or message sending exists.
- A future sending phase must add a kill switch before exposing any send boundary.
