# Security Policy

## Initial threat model

Phase 1 protects against accidental secret disclosure, public database/cache exposure, cross-workspace query mistakes, dependency-health hangs, verbose production errors, password disclosure, session fixation, cross-site auth mutations, open redirects, and basic login brute force. Later phases must additionally address prompt injection, file processing, encrypted provider keys, encrypted WhatsApp sessions, opt-out enforcement, and human takeover.

## Secret handling

- Keep secrets only in local or server `.env` files and approved secret stores.
- Generate independent high-entropy values for database, Redis, auth, encryption, and internal-service credentials.
- Never paste private Azure SSH keys into the repository or agent context.
- Logger redaction removes common credential fields. It is not a substitute for avoiding sensitive log payloads.
- Rotate a secret immediately if it appears in Git, logs, screenshots, or support output.

## Network exposure

PostgreSQL and Redis map only to `127.0.0.1` for local tooling and must never be allowed by Azure NSG or UFW. Production public ingress is limited to SSH (`22`), HTTP (`80`), and HTTPS (`443`). The Phase 0 web port binds to loopback until Caddy is introduced.

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

## Not implemented after Phase 1

- Application-level encryption for provider keys and WhatsApp sessions.
- Upload scanning, MIME enforcement, and private object storage.
- Caddy TLS termination and production monitoring.
- Automated backup scheduling and tested restore drills.
- WhatsApp, AI, RAG, CRM, skills, memory, and follow-up safety controls.

See `infra/README.md` for the backup/restore placeholder and host hardening checklist.
