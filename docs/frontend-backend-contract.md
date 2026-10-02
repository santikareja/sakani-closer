# Sakani Closer Frontend and Backend Contract

Last verified against the repository on 2026-10-02.

## Scope

This document records the contracts consumed by the dashboard redesign. It does not add routes, change database schema, or make future capabilities appear active. Tenant authority always comes from the authenticated server session. The browser never supplies `workspace_id`, account bindings, gateway credentials, or internal service tokens.

## Capability summary

| Capability                          | Status                                | Frontend behavior                                                  |
| ----------------------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| Login, logout, and session          | Available                             | Existing form and cookie flow is preserved.                        |
| WhatsApp status and controls        | Available to owner                    | Existing routes are used without request-shape changes.            |
| WhatsApp QR                         | Available when the gateway returns QR | No placeholder or generated QR is shown.                           |
| Conversation list and detail        | Available                             | Existing safe DTOs are normalized for presentation.                |
| Internal WhatsApp ingestion         | Internal only                         | Never called by the browser.                                       |
| Unread, assignment, attention flags | Unavailable                           | Controls are disabled and clearly labeled.                         |
| Contacts persistence and tags       | Unavailable                           | Contacts shell derives read-only rows from existing conversations. |
| AI, agents, knowledge, and audit    | Unavailable                           | Typed unavailable states only. No fake run or endpoint call.       |
| Analytics aggregations              | Unavailable                           | Empty chart and KPI states only. No demo values.                   |
| Outbound reply                      | Intentionally unavailable             | No send button, composer mutation, or outbound request exists.     |

## Existing browser contracts

### Authentication

| Route                | Method | Authentication                       | Request                                                        | Success                                                         | Error behavior                                              |
| -------------------- | ------ | ------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| `/api/auth/login`    | `POST` | Public, same-origin mutation         | Form data: `email`, `password`, optional safe `next`           | `303` redirect with encrypted session cookie                    | Redirects with safe error code; raw exception is not shown. |
| `/api/auth/logout`   | `POST` | Session cookie, same-origin mutation | Empty form post                                                | Revokes session and redirects to `/login?status=logged-out`     | Safe `503` response on infrastructure failure.              |
| `/api/auth/register` | `POST` | Public, same-origin mutation         | Form data: `displayName`, `workspaceName`, `email`, `password` | Creates owner and workspace, then redirects with session cookie | Rate limit and validation errors use safe redirects.        |

The dashboard continues to use `requireSession()` and the workspace from `CurrentSession`. No client-controlled workspace authority is accepted.

### WhatsApp

| Route                         | Method | Authentication                | Request                  | Response DTO                                                         | Loading and error behavior                                                                                    | Capability  |
| ----------------------------- | ------ | ----------------------------- | ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| `/api/v1/whatsapp/status`     | `GET`  | Owner session                 | No query parameters      | `{ connection, binding }` validated by `gatewayStatusResponseSchema` | Client shows skeleton or last known state, aborts superseded polling requests, and shows a safe retry message | Available   |
| `/api/v1/whatsapp/connect`    | `POST` | Owner session and same origin | Strict empty JSON object | Status DTO, normally `202`                                           | Action spinner plus aria-live toast; no optimistic connected state                                            | Available   |
| `/api/v1/whatsapp/disconnect` | `POST` | Owner session and same origin | Strict empty JSON object | Status DTO                                                           | Requires confirmation dialog; retains inline safe error state                                                 | Available   |
| `/api/v1/whatsapp/refresh`    | `POST` | Owner session and same origin | Strict empty JSON object | Status DTO, normally `202`                                           | Disconnects and reconnects through existing handler; action remains pending until response                    | Available   |
| `/api/v1/whatsapp/qr`         | `GET`  | Owner session                 | No query parameters      | `{ qr, expiresAt }` validated by `gatewayQrResponseSchema`           | QR renders only when the connection state is `qr_ready`; expiration clears it                                 | Conditional |

Normalized UI connection states are `connected | disconnected | connecting | unknown`. Binding states are `bound | unbound | unknown`. Raw gateway states remain unchanged at the route boundary.

Fields not returned by the current contract stay nullable:

- `accountIdentifier`
- `lastConnectedAt`
- `lastDisconnectedAt`

The UI never substitutes `default` for an absent account identifier.

### Inbox

| Route                       | Method | Authentication   | Request                                                | Response DTO                                                  | Loading and error behavior                                                              | Capability |
| --------------------------- | ------ | ---------------- | ------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------- |
| `/api/v1/conversations`     | `GET`  | Session required | Optional validated `cursor` and `limit` up to 50       | `ConversationListDto` with safe summaries and optional cursor | Route loading skeleton mirrors conversation rows; server errors render retry state      | Available  |
| `/api/v1/conversations/:id` | `GET`  | Session required | UUID path plus optional validated `cursor` and `limit` | `ConversationDetailDto` or safe `404`                         | Timeline skeleton and safe retry state; URL selection prevents stale client fetch races | Available  |

The current repository queries always include `workspace_id`. DTOs do not expose JID, provider message IDs, auth state, tokens, storage keys, or raw provider messages.

Current missing inbox fields remain nullable or unavailable:

- unread count and unread divider
- assignment and owner
- needs-attention flag
- delivery status
- account label
- full history synchronization
- realtime typing events

Search is presentation-only for the currently loaded page. Server pagination remains cursor based and sorted by the existing repository order. No unsupported filter is sent to an endpoint.

### Health

| Route         | Method | Authentication | Request | Response                                    | Capability |
| ------------- | ------ | -------------- | ------- | ------------------------------------------- | ---------- |
| `/api/health` | `GET`  | Public         | None    | Safe app, database, and Redis health report | Available  |

### Internal ingestion

`POST /api/v1/internal/whatsapp/messages` is authenticated with `INTERNAL_SERVICE_TOKEN` and is reserved for the gateway. It is not a browser contract, is not referenced by interactive dashboard code, and must remain inaccessible to client-side calls.

## Adapter boundary

The redesign keeps existing route and repository DTOs intact, then normalizes them through:

- `lib/dashboard/adapter.ts`
- `lib/inbox/adapter.ts`
- `lib/whatsapp/adapter.ts`
- `lib/ai/adapter.ts`

Presentation contracts live in:

- `types/dashboard.ts`
- `types/inbox.ts`
- `types/whatsapp.ts`
- `types/ai.ts`

Components receive these stable presentation DTOs rather than database rows. Nullable values are rendered as `Belum tersedia`, never replaced with invented data.

## Future backend work

Future work should be implemented in separate approved phases:

1. Add workspace-scoped unread state, assignment, and attention flags with backward-compatible conversation DTO fields.
2. Add a dedicated contacts read contract before enabling tags, drawer edits, or persistence.
3. Add audited AI provider, agent, knowledge, and run contracts before enabling any control.
4. Add workspace-scoped analytics aggregation endpoints before showing KPI values or charts.
5. Approve and design outbound messaging separately. Human takeover, opt-out, grounding, numeric validation, and workspace authorization must remain mandatory.

No frontend shell in this redesign is evidence that a future backend capability is active.
