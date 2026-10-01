# Sakani Closer — Product Requirements Document & Implementation Plan

Version: 1.0
Date: 2026-09-30
Owner: Santika Reza / Sakani
Status: MVP Planning

## 1. Purpose

Sakani Closer is an AI-enabled WhatsApp property-marketing agent. It connects one private WhatsApp number through QR login using Baileys, receives and sends direct messages, maintains lead context, answers from a controlled knowledge base, qualifies leads, scores intent, and performs limited follow-up to leads that contacted the number first.

The initial product is for internal use by Sakani. The architecture must be clean enough to evolve into a multi-tenant SaaS with up to three WhatsApp accounts per workspace, monthly platform credits, isolated data, and configurable skills.

## 2. Product Principles

1. Accuracy before fluency: never invent property facts, prices, promotions, availability, financing figures, or legal claims.
2. Human control: owner messages pause automation for that conversation; uncertain answers escalate.
3. Short, useful replies: friendly Indonesian, professional but natural, normally no more than three short sentences, ending with one relevant question.
4. Evidence-based actions: every factual AI answer must be traceable to retrieved knowledge or structured catalog data.
5. Safe follow-up: only contact leads that initiated a chat; stop on opt-out, reply, booking, or human takeover.
6. Production-first architecture: persistent WhatsApp gateway and workers run on a VM; the web UI can later be deployed separately.
7. Configuration over hardcoding: provider, models, projects, stages, skills, prompts, sequences, and thresholds are configurable.
8. Privacy and secrets: API keys, WhatsApp sessions, and personal lead data are encrypted or protected and never committed to Git.

## 3. Scope

### MVP must include

- Email/password owner authentication.
- One WhatsApp account connected by QR; data model supports three later.
- Baileys gateway for direct/private chats only; ignore groups and status messages.
- Receive/send text, images, and PDF/document messages.
- Inbox with conversations, message history, AI status, human takeover, and escalation state.
- OpenAI-compatible BYOK provider: base URL, encrypted API key, connection test, `/models` discovery, manual model fallback.
- Separate model roles: chat, fast/classification, embeddings; optional vision and transcription roles.
- Knowledge sources: text, URL/domain crawl, PDF, image/OCR or vision, CSV/XLSX, and later Google Drive connector.
- RAG with pgvector, hybrid search, source citations, confidence threshold, and numeric validation.
- Structured property catalog: projects, unit types, prices, DP, installments, promotions, availability, facilities, and location.
- Lead profile, qualification fields, pipeline stages, tags, notes, and Hot/Warm/Cold scoring.
- Full-auto response with uncertainty escalation.
- Automatic human takeover when the owner responds from the phone; manual resume-AI action.
- Property skills: lead qualification, KPR simulation, survey-intent collection, objection handling, project recommendation, booking CTA.
- Follow-up sequences up to five messages; default H+1, H+3, H+7, H+14, H+30; opt-out and booking stop rules.
- Audit log, usage events, memory review queue, and health checks.
- Docker Compose deployment on Azure Ubuntu VM.

### Later phases

- Multi-number and multi-tenant SaaS.
- Monthly credit plans and billing.
- Team roles and shared inbox.
- Telegram/email notifications.
- Calendar integration and actual survey booking.
- Campaign/source attribution and UTM tracking.
- Voice-note transcription.
- External CRM, Sheets, n8n, and webhooks.
- Advanced analytics and closing-pattern learning.

## 4. Users and Roles

MVP has one Owner role. Future roles: Workspace Admin, Manager, Agent, Viewer.

The system must include `workspace_id` on tenant-owned tables from day one. Do not assume a single global workspace in application code.

## 5. Core User Journeys

### 5.1 Connect WhatsApp

1. Owner opens Settings > WhatsApp.
2. System starts a Baileys session.
3. Dashboard displays QR and connection status.
4. Owner scans QR from WhatsApp Linked Devices.
5. Gateway persists encrypted auth state and reports connected status.
6. Reconnects are automatic after transient failures.
7. Owner can disconnect, reconnect, and delete a session.

### 5.2 Configure AI provider

1. Owner enters compatible base URL and API key.
2. System encrypts the API key before persistence.
3. Owner clicks Test Connection.
4. System calls normalized `/models` endpoint, accepting base URLs with or without `/v1`.
5. Owner selects chat, fast, embedding, vision, and transcription models.
6. If `/models` is unavailable, owner enters model IDs manually.
7. System disables unsupported capabilities rather than pretending they exist.

### 5.3 Add knowledge

1. Owner creates a source with type, title, project scope, and metadata.
2. System ingests content asynchronously.
3. Content is extracted, normalized, chunked, embedded, and indexed.
4. Source status progresses pending -> processing -> ready or failed.
5. Owner can view extracted text, source metadata, chunk count, errors, and re-index.
6. Knowledge remains draft until approved if it contains memories or generated FAQ; factual source documents can be active after successful ingestion.

### 5.4 Receive and answer a lead

1. Gateway receives a direct inbound message.
2. System deduplicates by WhatsApp message ID.
3. Consecutive messages are debounced for 5–8 seconds.
4. Conversation is loaded with recent history, lead profile, approved memories, project scope, and human-takeover state.
5. Intent router selects a skill.
6. Retriever searches scoped knowledge and catalog.
7. Agent generates a concise Indonesian reply.
8. Validator checks evidence, prohibited claims, numerical consistency, length, and question-ending rule.
9. If valid, the send queue sends the reply with typing indicator and rate limits.
10. If uncertain, send a short acknowledgement such as “Saya cek dulu ya, nanti saya pastikan informasinya.” Then create an escalation.

### 5.5 Human takeover

- An outbound message originating from the owner’s phone pauses AI for that conversation.
- Dashboard displays `human_active`.
- New inbound messages are stored but not auto-replied.
- Owner can click Resume AI.
- Resume requires an explicit action and records an audit event.

### 5.6 Follow-up

- Only leads that first contacted the account are eligible.
- A sequence schedules at most five messages.
- Any inbound reply resets or stops the current sequence according to configuration.
- Stop for opt-out, “stop”, “jangan hubungi”, booking or later stage, or human takeover.
- Follow-ups respect quiet hours, daily limits, randomized delay, and a per-lead cooldown.

## 6. Functional Requirements

### 6.1 WhatsApp Gateway

- Use Baileys in a separate Node.js service.
- Support QR login and persistent multi-device auth.
- Ignore groups, broadcasts, status, and unsupported message types.
- Normalize message types into an internal schema.
- Store inbound/outbound messages with provider message ID and timestamps.
- Handle reconnect, logout, QR refresh, auth failure, and backoff.
- Use an internal authenticated API or Redis events between gateway and application.
- Never expose Baileys credentials to the browser.
- Apply per-recipient queueing, minimum delay, max daily sending, quiet hours, and idempotency.
- Do not implement cold outreach or bulk broadcast.

### 6.2 Message Types

MVP: text, image, PDF/document. Store media metadata and encrypted/private object storage path. Download and process media asynchronously. Limit file size and reject unsupported MIME types. Use vision/OCR only when a configured model exists.

### 6.3 AI Adapter

Implement a provider-neutral interface:

- `listModels()`
- `testConnection()`
- `chatCompletion()`
- `streamChatCompletion()` optional
- `createEmbedding()`
- `describeImage()` optional
- `transcribeAudio()` optional

Normalize provider errors, timeouts, retries, rate limits, context-window errors, and unsupported capabilities. Never log raw API keys or full prompts containing personal data.

### 6.4 RAG and Grounding

Retrieval must be scoped by workspace and project. Use vector search plus PostgreSQL full-text search. Return source IDs, titles, page numbers where available, chunk text, and confidence. Catalog facts should be retrieved through typed database queries or tools.

Grounding policy:

- No evidence: do not answer the factual question; escalate.
- Conflicting sources: prefer the latest approved source or escalate if unclear.
- Prices and numeric terms: compare generated numbers against structured data and retrieved evidence.
- Do not infer availability, legal status, guarantees, ROI, or approval without explicit evidence.
- Store retrieval trace for audit, not necessarily expose citations to leads.

### 6.5 Lead and CRM

Default pipeline: Baru, Terkualifikasi, Survei, Sudah Survei, Booking, Akad, Closing, Lost.

Profile fields: name, budget, income, employment, target location, purpose, household size, KPR status, preferred project/unit, purchase timeline, objections, consent/opt-out, and source conversation.

Lead scoring must return Hot/Warm/Cold, numeric score, reasons, and timestamp. The score is a recommendation, not a financial or legal decision.

### 6.6 Skills

Skill schema: name, version, enabled, trigger intents, system instructions, allowed tools, required fields, output constraints, and examples.

Built-in skills:

- Lead qualification.
- Project and unit recommendation.
- KPR simulation using deterministic application code.
- Objection handling.
- Survey-intent collection without calendar booking.
- Booking CTA.

The Skill Builder must support draft, test sandbox, versioning, approval, activation, rollback, and audit history. Never allow arbitrary skill code execution from user input.

### 6.7 Memory

Lead memory is extracted from conversation and stored as pending until owner approval. Approved memory can influence responses. Memory types: profile fact, preference, objection, project interest, successful answer, FAQ candidate, and owner correction.

Each memory stores source message IDs, confidence, created/updated timestamps, status, reviewer, and version. Support edit, approve, reject, delete, and rollback.

### 6.8 Follow-up

Default sequence is configurable but capped at five steps. Each job stores scheduled time, reason, generated draft, approval mode, status, attempts, provider message ID, and stop reason.

MVP full-auto follow-up is allowed only after the lead has initiated a conversation. Add a global kill switch and per-lead pause.

## 7. Non-Functional Requirements

- TypeScript strict mode.
- All API input validated with Zod or equivalent.
- Server-side authorization on every workspace-scoped query.
- Database migrations committed to Git.
- API keys encrypted at rest using an application encryption key held only in environment secrets.
- HTTPS required for production dashboard.
- No secrets in source control, logs, screenshots, or error messages.
- Structured JSON logs with request ID and workspace ID, redacting message content by default.
- Retries with exponential backoff and dead-letter handling for jobs.
- Health endpoints for web, database, Redis, worker, and gateway.
- Backups for PostgreSQL and WhatsApp session data.
- Graceful shutdown for gateway and workers.
- Tests for grounding, numeric validation, opt-out detection, takeover, deduplication, and follow-up stopping.
- Initial target: one workspace, one connected number, three concurrent inbound conversations; architecture should scale later.

## 8. Recommended Architecture

### Services

- `web`: Next.js App Router dashboard and internal API.
- `wa-gateway`: Node.js + Baileys persistent connection.
- `worker`: BullMQ jobs for ingestion, embeddings, AI processing, scoring, memory, and follow-up.
- `postgres`: PostgreSQL with pgvector.
- `redis`: queue and short-lived state.
- `proxy`: Caddy for HTTPS and routing.

### Stack

- Next.js + TypeScript.
- Tailwind + shadcn/ui.
- Drizzle ORM or Prisma; choose one and do not mix.
- PostgreSQL + pgvector.
- Redis + BullMQ.
- Docker Compose on Azure Ubuntu VM.
- GitHub repository and CI checks.

### Deployment

MVP runs on one Azure VM with persistent Docker volumes. Only ports 22, 80, and 443 are public. PostgreSQL, Redis, gateway internal API, and worker ports stay private. Later split web to Vercel and persistent services to a VM if useful.

## 9. Data Model

Every tenant-owned record includes `workspace_id`, timestamps, and appropriate indexes.

Core tables:

- `workspaces`, `users`, `memberships`.
- `wa_accounts`, `wa_sessions`.
- `contacts`, `conversations`, `messages`, `message_media`.
- `leads`, `lead_profiles`, `pipeline_stages`, `lead_stage_events`, `lead_scores`, `lead_tags`, `lead_notes`.
- `projects`, `unit_types`, `unit_prices`, `promotions`, `assets`.
- `kb_sources`, `kb_documents`, `kb_chunks`, `kb_ingestion_jobs`.
- `ai_providers`, `ai_model_roles`, `ai_capabilities`, `ai_usage_events`.
- `skills`, `skill_versions`, `skill_runs`.
- `memories`, `memory_reviews`.
- `followup_sequences`, `followup_steps`, `followup_jobs`.
- `escalations`, `audit_logs`, `system_settings`, `credit_ledger`.

Required constraints:

- Unique `(workspace_id, provider_message_id)` for message idempotency.
- Unique `(workspace_id, phone_number)` for active WhatsApp account.
- Foreign keys with safe deletion behavior.
- Index conversation lookup by workspace, contact, updated time.
- Vector index for embeddings; full-text index for chunk text.
- Never use a global unscoped repository query.

## 10. API and Events

Internal endpoints should be versioned under `/api/v1`.

Examples:

- `GET /api/v1/health`.
- `POST /api/v1/whatsapp/accounts/:id/connect`.
- `GET /api/v1/whatsapp/accounts/:id/qr`.
- `POST /api/v1/whatsapp/accounts/:id/disconnect`.
- `POST /api/v1/ai/providers/test`.
- `GET /api/v1/ai/providers/:id/models`.
- `POST /api/v1/knowledge/sources`.
- `POST /api/v1/knowledge/sources/:id/ingest`.
- `GET /api/v1/conversations`.
- `POST /api/v1/conversations/:id/resume-ai`.
- `POST /api/v1/messages/:id/retry`.
- `POST /api/v1/leads/:id/score`.
- `POST /api/v1/followups/:id/pause`.

Internal events:

- `wa.message.received`.
- `wa.message.sent`.
- `wa.connection.updated`.
- `ai.reply.requested`.
- `ai.reply.completed`.
- `ai.escalation.created`.
- `kb.ingestion.requested`.
- `kb.ingestion.completed`.
- `followup.due`.
- `lead.updated`.

## 11. Environment Variables

Create `.env.example`; never commit `.env`.

Required examples:

```env
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://redis:6379
SESSION_ENCRYPTION_KEY=replace-with-32-byte-secret
API_ENCRYPTION_KEY=replace-with-32-byte-secret
AUTH_SECRET=replace-with-long-secret
INTERNAL_SERVICE_TOKEN=replace-with-long-secret
WA_GATEWAY_URL=http://wa-gateway:3001
AI_DEFAULT_TIMEOUT_MS=30000
RAG_MIN_CONFIDENCE=0.72
FOLLOWUP_TIMEZONE=Asia/Jakarta
```

Secrets must be generated with a cryptographically secure generator and injected through server environment configuration.

## 12. Observability and Operations

- `/health` and `/ready` endpoints.
- Docker restart policies for gateway, worker, Redis, and Postgres.
- Log rotation.
- Daily database dump to a protected backup directory, with retention.
- Monitor disk, memory, Docker health, QR/session status, queue failure count, and provider error count.
- Global pause-AI and pause-followups controls.
- Admin-only diagnostic page with redacted logs.

## 13. Security and Safety

- SSH key authentication only; disable password login after verifying key access.
- Keep Azure NSG and UFW aligned; public ports only 22, 80, 443.
- Encrypt provider keys and WhatsApp auth state.
- Do not expose Redis or Postgres.
- Sanitize uploaded files and enforce size/MIME limits.
- Prevent prompt injection from documents: treat source text as untrusted content, never as system instructions.
- Never execute code from URLs, PDFs, skills, or model output.
- Detect opt-out and honor it immediately.
- Do not send cold outreach or bulk messages.
- Keep an audit record for automation state, human takeover, model changes, knowledge approvals, and follow-ups.

## 14. Acceptance Criteria

MVP is accepted when:

1. Owner can connect one WhatsApp account with QR and reconnect after a service restart.
2. A private inbound text creates exactly one stored message and one processing job.
3. AI answers an indexed property question using approved knowledge and records the source trace.
4. AI refuses/escalates a question absent from knowledge instead of inventing an answer.
5. Generated price or installment numbers cannot differ from structured catalog data.
6. Owner messages from the phone pause AI for that conversation.
7. Owner can resume AI explicitly.
8. A lead profile is extracted and can be edited.
9. Lead score displays category and reasons.
10. Follow-up sends no more than five jobs, never to a contact that did not initiate chat, and stops on opt-out/reply/booking/human takeover.
11. API keys are not visible in browser responses or logs.
12. PostgreSQL and Redis are not publicly reachable.
13. Docker Compose restart restores all services except a WhatsApp session requiring re-authentication.
14. Health checks and backup commands work from the VM.

## 15. Implementation Plan

### Phase 0 — Server and repository foundation

Goal: reproducible local and Azure deployment.

Tasks:

- Create GitHub repository `sakani-closer`.
- Add monorepo structure and package manager workspace.
- Add TypeScript, lint, format, test, and commit checks.
- Create `docker-compose.yml` for Postgres+pgvector and Redis.
- Add `.env.example`, `.gitignore`, README, and security policy.
- Add web health route and service health checks.
- Configure Azure VM folder and deployment instructions.

Definition of done: `docker compose up -d`, database migration, health checks, and web response work locally and on the VM.

### Phase 1 — Database and authentication

- Choose Drizzle or Prisma.
- Create workspace/owner schema.
- Add authentication and protected dashboard shell.
- Add migration and seed for default workspace and pipeline stages.
- Add authorization helper requiring workspace context.

Definition of done: owner can sign in and see an empty dashboard; all queries are workspace scoped.

### Phase 2 — WhatsApp gateway

- Implement Baileys service.
- QR event streaming to web through authenticated backend.
- Persist encrypted auth state.
- Normalize inbound/outbound messages.
- Ignore groups/status/broadcasts.
- Implement reconnect, logout, message deduplication, media download metadata.
- Add send queue with rate limits and quiet hours.
- Detect owner-originated messages and publish takeover event.

Definition of done: a direct chat appears in inbox; a test reply sends; restart reconnects; owner phone message pauses automation.

### Phase 3 — Inbox and conversation controls

- Build three-panel responsive inbox.
- Conversation timeline with media previews.
- AI active/paused/human/escalated states.
- Manual reply and Resume AI.
- Search, unread, project, lead-score, and takeover filters.
- Audit events for manual actions.

Definition of done: owner can operate the inbox without opening the database.

### Phase 4 — BYOK AI provider

- Add encrypted provider credential storage.
- Implement normalized OpenAI-compatible client.
- Normalize base URL and `/models`.
- Add test connection and model discovery.
- Add manual model fallback.
- Add role assignment and capability detection.
- Record usage, latency, status, and token metadata.

Definition of done: provider can be tested, models can be selected, and a simple completion runs without exposing the key.

### Phase 5 — Knowledge ingestion and catalog

- Implement source CRUD and project scope.
- Add text, PDF, URL, image, CSV/XLSX ingestion adapters.
- Add extraction, normalization, chunking, embedding, and pgvector storage.
- Add full-text search and hybrid retrieval.
- Add project/unit/promo catalog tables and admin forms/imports.
- Add ingestion job status and retry.
- Add source trace and document approval/versioning.

Definition of done: an owner can upload a brochure and create a unit price record; retrieval returns relevant evidence with source metadata.

### Phase 6 — Agent engine and grounding validator

- Implement conversation context builder.
- Implement intent router and skill selection.
- Implement grounded prompt templates.
- Implement response validator for evidence, numbers, length, prohibited claims, and final question.
- Implement uncertainty acknowledgement and escalation.
- Implement media asset tool for approved brochures/images.
- Add shadow mode for testing before full auto.

Definition of done: grounded questions are answered, unsupported questions escalate, and invalid numeric answers never send.

### Phase 7 — Lead CRM and scoring

- Extract profile fields from messages.
- Create editable lead profile and timeline.
- Implement configurable pipeline stages.
- Implement Hot/Warm/Cold score with reasons.
- Add tags, notes, project association, and lead filters.
- Add approved memory extraction and review queue.

Definition of done: a test conversation becomes a lead with editable profile, score, stage, and approved memory.

### Phase 8 — Skills and KPR simulation

- Implement skill schema/versioning.
- Add built-in qualification, recommendation, objection, survey-intent, booking, and KPR skills.
- Implement deterministic KPR calculator with configurable assumptions.
- Add skill sandbox, approval, activation, rollback.

Definition of done: owner can test and activate a skill without changing code, and KPR output is calculated by application code.

### Phase 9 — Follow-up automation

- Add sequence and step editor.
- Add BullMQ delayed jobs.
- Generate context-aware drafts.
- Enforce lead-initiated eligibility.
- Detect reply, opt-out, booking, and takeover stops.
- Add per-lead pause, global kill switch, daily limit, quiet hours, randomized delay, and audit trail.

Definition of done: a controlled test lead receives at most five follow-ups and all stop conditions work.

### Phase 10 — Production hardening

- Configure Caddy HTTPS and domain.
- Harden SSH and verify recovery access.
- Add database/session backups.
- Add log rotation and disk alerts.
- Add health monitoring and failed-job dashboard.
- Run security review and dependency audit.
- Run a two-week shadow mode with real conversations.
- Enable full auto gradually per selected conversation/project.

Definition of done: system survives restart, backup restore is tested, and owner can globally pause automation.

## 16. Agent Working Rules

AI coding agents must:

1. Read this document and `AGENTS.md` before changing code.
2. Inspect the existing repository; do not overwrite working code blindly.
3. Implement one phase or vertical slice at a time.
4. Before coding, state files to change, assumptions, schema impact, and tests.
5. Prefer small, reversible commits.
6. Run typecheck, lint, unit tests, and build after meaningful changes.
7. Never place real API keys, WhatsApp sessions, lead exports, or private documents in Git.
8. Never add a public port without documenting why and updating both Azure NSG and UFW instructions.
9. Never bypass grounding, numeric validation, opt-out, takeover, or workspace authorization.
10. If requirements conflict, prioritize safety, evidence, human takeover, and data isolation.
11. Do not silently introduce third-party SaaS or paid services.
12. Report migration, environment, deployment, and rollback steps with every infrastructure change.

## 17. Suggested AGENTS.md Summary

- Project language: Indonesian UI and user-facing messages; technical identifiers and code in English.
- User-facing AI tone: concise, friendly, professional, ending with a relevant question.
- No cold outreach; no groups; only lead-initiated WhatsApp conversations.
- Knowledge-grounded answers only; escalate uncertainty.
- Owner phone message pauses AI.
- All secrets server-side and encrypted.
- All tenant data scoped by workspace.
- Use Docker Compose; do not expose Postgres or Redis.
- Use deterministic code for financial calculations.

## 18. Default Configuration

```yaml
whatsapp:
  max_accounts_per_workspace: 3
  mvp_accounts: 1
  groups: false
  cold_outreach: false
  debounce_seconds: 6
  quiet_hours: "21:00-08:00"
  max_followups: 5

agent:
  mode: full_auto
  shadow_mode_initially: true
  max_reply_sentences: 3
  require_final_question: true
  escalation_text: "Saya cek dulu ya, nanti saya pastikan informasinya."
  minimum_rag_confidence: 0.72

followups:
  default_delays: [1, 3, 7, 14, 30]
  timezone: Asia/Jakarta
  stop_on_reply: true
  stop_on_opt_out: true
  stop_on_booking: true
  stop_on_human_takeover: true

knowledge:
  max_initial_storage_mb: 50
  hybrid_search: true
  require_source_trace: true
  approve_generated_memory: true

security:
  public_ports: [22, 80, 443]
  encrypt_provider_keys: true
  encrypt_whatsapp_sessions: true
  redact_secrets_in_logs: true
```

## 19. First Agent Prompt

Use this prompt for the first implementation task:

> You are the lead engineer for Sakani Closer. Read `PRD.md`, `AGENTS.md`, and the repository before changing anything. Implement only Phase 0: repository foundation and local Docker Compose with PostgreSQL+pgvector, Redis, and a minimal Next.js health page. Do not implement WhatsApp, AI, RAG, follow-up, or CRM yet. First inspect the environment and report the proposed files, commands, assumptions, and risks. Use TypeScript strict mode, workspace-scoped configuration, `.env.example`, no real secrets, health checks, persistent named volumes, and no public database/Redis ports. After implementation run lint, typecheck, tests, build, and `docker compose config`. Report exact results and any remaining manual Azure deployment steps.

## 20. Change Log

- 1.0: Initial internal MVP PRD and phased implementation plan.
