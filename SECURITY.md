# Security Policy

## Initial threat model

The current system protects against accidental secret disclosure, public database/cache/gateway exposure, cross-workspace query mistakes, session fixation, cross-site auth mutations, plaintext WhatsApp credentials, unauthenticated gateway control, QR persistence, and unbounded reconnect loops. Batch 1 additionally protects inbound ingestion with a private bearer-authenticated boundary, strict canonical payload validation, HMAC-derived JID identifiers, workspace/account binding, database uniqueness, and safe DTOs. Later phases must additionally address prompt injection, file processing, encrypted provider keys, opt-out enforcement, and human takeover.

## Secret handling

- Keep secrets only in local or server `.env` files and approved secret stores.
- Generate independent high-entropy values for database, Redis, auth, encryption, and internal-service credentials.
- Never paste private Azure SSH keys into the repository or agent context.
- Logger redaction removes common credential fields. It is not a substitute for avoiding sensitive log payloads.
- Rotate a secret immediately if it appears in Git, logs, screenshots, or support output.
- WhatsApp credentials are encrypted at rest with AES-256-GCM and a unique 96-bit IV per write. The authentication tag is verified on every read; corrupted or wrong-key data fails closed.
- Keep `SESSION_ENCRYPTION_KEY` outside the auth-state volume and backup it separately. Losing it makes the encrypted session unrecoverable; exposing it compromises that session.
- QR payloads are ephemeral secrets. They remain in memory, expire after 60 seconds, and must never be placed in logs, metrics, URLs, terminal output, or persistent storage.

## Network exposure

PostgreSQL and Redis map only to `127.0.0.1` for local tooling and must never be allowed by Azure NSG or UFW. The WhatsApp gateway exposes port `3001` only to its private Compose bridge and has no host port. Production public ingress is limited to SSH (`22`), HTTP (`80`), and HTTPS (`443`). The web port binds to loopback until Caddy is introduced.

All `/internal/*` gateway routes require an independent high-entropy bearer token and compare token digests in constant time. Connect and QR reads are rate-limited. `/health` is intentionally unauthenticated for internal orchestration and returns only sanitized connection state. The owner-facing web routes require a valid server session; mutations also require the configured same origin. The internal token never enters client code or browser responses.

## WhatsApp and Baileys risk

Baileys uses an unofficial WhatsApp Web protocol. WhatsApp can change the protocol or restrict an account without notice. Phase 2A pins release-candidate version `7.0.0-rc14`; upgrades require a changelog/type review, full tests, and a manual staging login with a dedicated backup/test number. Do not use a critical sales number for initial validation.

Message sending, cold outreach, bulk messaging, groups, broadcasts, and pairing codes are not implemented. Private inbound messages are normalized in memory; raw `WAMessage` objects and full JIDs are not persisted or returned by public APIs. JID hashes are keyed with the gateway session-encryption key, while the internal service token is reserved for service authentication; only masked phone metadata can reach the inbox. Existing sessions require a one-time authenticated Connect after Batch 1 deployment so the encrypted gateway binding can associate inbound events with the session-derived workspace.

Startup reconnect remains limited to authenticated, registered state with reconnect intent enabled. Transient reconnects stop after five attempts; logged-out, invalid-auth, and explicitly disconnected sessions do not retry. Confirmed logout removes only invalid auth records, while explicit disconnect preserves valid encrypted credentials. A future sending slice must add an explicit kill switch, opt-out enforcement, workspace authorization, throttling, and human takeover before any production use.

## Error handling

Production API errors return stable codes and correlation IDs without stack traces, connection strings, credentials, or raw dependency errors.

## Authentication and sessions

- Passwords use Argon2id and are never stored or logged in plaintext.
- Login creates a fresh random 256-bit token. Only its SHA-256 hash is stored in PostgreSQL.
- The cookie payload is encrypted and authenticated with `AUTH_SECRET`, is HTTP-only, SameSite=Lax, expires after seven days, and is Secure in production.
- Logout revokes the database session and expires the browser cookie.
- Auth mutations require the configured application origin. Post-login redirects remain same-origin.
- Redis enforces a five-attempt, fifteen-minute login window per hashed IP/email key.
- Session lookup, membership checks, and audit records always include the workspace context.

## Reporting

Report vulnerabilities privately to the repository owner. Include impact, reproduction steps with synthetic data, and a suggested mitigation. Do not open a public issue containing credentials or customer data.

## Not implemented after Batch 1

- Application-level encryption for provider keys.
- Upload scanning, MIME enforcement, and private object storage.
- Caddy TLS termination and production monitoring.
- Automated backup scheduling and tested restore drills.
- Validated production outbound WhatsApp sending, AI, RAG, CRM, skills, memory, and follow-up safety controls.

See `infra/README.md` for the backup/restore placeholder and host hardening checklist.
