# Security Policy

## Initial threat model

Phase 2A protects against accidental secret disclosure, public database/cache/gateway exposure, cross-workspace query mistakes, dependency-health hangs, verbose production errors, password disclosure, session fixation, cross-site auth mutations, open redirects, basic login brute force, plaintext WhatsApp credentials, unauthenticated gateway control, QR persistence, and tight reconnect loops. Later phases must additionally address prompt injection, file processing, encrypted provider keys, opt-out enforcement, and human takeover.

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

All `/internal/*` gateway routes require an independent high-entropy bearer token and compare token digests in constant time. Connect and QR reads are rate-limited. `/health` is intentionally unauthenticated for internal orchestration and returns only sanitized connection state.

## WhatsApp and Baileys risk

Baileys uses an unofficial WhatsApp Web protocol. WhatsApp can change the protocol or restrict an account without notice. Phase 2A pins release-candidate version `7.0.0-rc14`; upgrades require a changelog/type review, full tests, and a manual staging login with a dedicated backup/test number. Do not use a critical sales number for initial validation.

Message sending, cold outreach, bulk messaging, groups, broadcasts, pairing codes, and automatic startup login are not implemented. A future sending slice must add an explicit kill switch, opt-out enforcement, workspace authorization, throttling, and human takeover before any production use.

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

## Not implemented after Phase 2A

- Application-level encryption for provider keys.
- Upload scanning, MIME enforcement, and private object storage.
- Caddy TLS termination and production monitoring.
- Automated backup scheduling and tested restore drills.
- Owner-facing QR proxy/UI, validated WhatsApp login, message handling/sending, AI, RAG, CRM, skills, memory, and follow-up safety controls.

See `infra/README.md` for the backup/restore placeholder and host hardening checklist.
