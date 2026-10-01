# Contributing

## Working agreement

- Read the PRD and `AGENTS.md` before starting.
- Keep changes within one phase and one clear concern.
- Create a branch, make small reversible commits, and use English commit messages.
- Do not commit `.env`, credentials, customer data, private documents, or generated runtime state.
- Document schema, environment, public-port, deployment, and rollback impact.

## Local quality gates

```bash
pnpm install
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docker:check
```

Integration checks require PostgreSQL and Redis. Start them with `docker compose up -d postgres redis`, then run migration and seed before the test suite.

## Pull request checklist

- Scope is traceable to the active phase.
- Workspace isolation is preserved.
- External input is validated.
- Significant behavior has tests.
- No secret or private data is present.
- Operational and rollback steps are documented where relevant.
