# PRD Notes for Phase 0

## Scope interpretation

The PRD implementation plan places the workspace/owner schema and default pipeline seed in Phase 1. The Phase 0 execution brief explicitly requires six foundational tables plus the Sakani workspace and default stages. This repository follows the more specific execution brief while stopping before authentication or CRM behavior.

## Assumptions

- `users` is global identity data; tenant access is represented by `memberships`.
- `memberships`, `pipeline_stages`, `system_settings`, and `audit_logs` are tenant-owned and include `workspace_id`.
- Phase 0 settings use a JSON value because no domain-specific settings schema is yet approved.
- Audit metadata must be small and redacted; full chat content is not audit metadata.
- The default Sakani workspace is identified by the stable slug `sakani`. Seed operations use conflict handling and are safe to repeat.
- PostgreSQL and Redis loopback bindings exist only for host-side local tools. They are not public interfaces.
