# Sakani Closer Agent Rules

1. Read `PRD-Sakani-Closer.md` completely before changing architecture or scope.
2. Use Bahasa Indonesia for UI copy and user-facing messages. Use English for code, schema, technical identifiers, and commit messages.
3. Keep TypeScript strict mode enabled.
4. Every tenant-owned record and query must include and enforce `workspace_id`.
5. Validate every external input at its boundary. Zod is the default schema validator.
6. Never store secrets, private keys, WhatsApp sessions, lead exports, uploads, or real customer documents in Git.
7. Never expose PostgreSQL or Redis publicly. Document any new public port before adding it.
8. Do not implement cold outreach, bulk WhatsApp messaging, groups, or broadcasts.
9. Preserve explicit human takeover. Never auto-resume AI after an owner message.
10. Escalate knowledge that is missing, stale, or conflicting. Do not guess property facts.
11. Calculate KPR and other financial figures deterministically in application code, not in model output.
12. Add tests for every significant behavior or infrastructure change.
13. Do not modify files unrelated to the task.
14. Do not log API keys, tokens, WhatsApp auth state, private documents, or full chat content by default.
15. Never bypass grounding, numeric validation, opt-out, takeover, or workspace authorization.
16. Never run destructive database, volume, or filesystem commands without explicit approval.

## Phase boundaries

Implement one phase or vertical slice at a time. Phase 0 is repository and deployment foundation only: no live WhatsApp connection, AI provider call, RAG, CRM workflow, memory extraction, skill execution, or follow-up automation.

## Required verification

For meaningful changes run formatting checks, lint, TypeScript checks, tests, build, and relevant Docker/DB validation. Report commands that could not be run and why.
