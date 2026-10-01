import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 64 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("workspaces_slug_uidx").on(table.slug)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 120 }),
    defaultWorkspaceId: uuid("default_workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    passwordHash: varchar("password_hash", { length: 512 }),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_uidx").on(table.email),
    index("users_default_workspace_idx").on(table.defaultWorkspaceId),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).default("owner").notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("memberships_workspace_user_uidx").on(table.workspaceId, table.userId),
    index("memberships_user_idx").on(table.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sessions_workspace_token_uidx").on(table.workspaceId, table.tokenHash),
    index("sessions_workspace_user_idx").on(table.workspaceId, table.userId),
    index("sessions_workspace_expires_idx").on(table.workspaceId, table.expiresAt),
  ],
);

export const waAccounts = pgTable(
  "wa_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    gatewayAccountId: varchar("gateway_account_id", { length: 64 }).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    accountIdentifierMasked: varchar("account_identifier_masked", { length: 32 }),
    status: varchar("status", { length: 32 }).default("disconnected").notNull(),
    lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
    lastDisconnectedAt: timestamp("last_disconnected_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("wa_accounts_workspace_gateway_uidx").on(table.workspaceId, table.gatewayAccountId),
    uniqueIndex("wa_accounts_workspace_id_uidx").on(table.workspaceId, table.id),
    index("wa_accounts_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    waAccountId: uuid("wa_account_id").notNull(),
    waJidHash: varchar("wa_jid_hash", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 120 }),
    phoneMasked: varchar("phone_masked", { length: 32 }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.waAccountId],
      foreignColumns: [waAccounts.workspaceId, waAccounts.id],
      name: "contacts_workspace_account_fk",
    }).onDelete("cascade"),
    uniqueIndex("contacts_workspace_account_jid_uidx").on(
      table.workspaceId,
      table.waAccountId,
      table.waJidHash,
    ),
    uniqueIndex("contacts_workspace_id_uidx").on(table.workspaceId, table.id),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    waAccountId: uuid("wa_account_id").notNull(),
    contactId: uuid("contact_id").notNull(),
    status: varchar("status", { length: 32 }).default("open").notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.waAccountId],
      foreignColumns: [waAccounts.workspaceId, waAccounts.id],
      name: "conversations_workspace_account_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceId, table.contactId],
      foreignColumns: [contacts.workspaceId, contacts.id],
      name: "conversations_workspace_contact_fk",
    }).onDelete("cascade"),
    uniqueIndex("conversations_workspace_account_contact_uidx").on(
      table.workspaceId,
      table.waAccountId,
      table.contactId,
    ),
    uniqueIndex("conversations_workspace_account_id_uidx").on(
      table.workspaceId,
      table.waAccountId,
      table.id,
    ),
    index("conversations_workspace_last_message_idx").on(
      table.workspaceId,
      table.lastMessageAt,
      table.id,
    ),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    waAccountId: uuid("wa_account_id").notNull(),
    conversationId: uuid("conversation_id").notNull(),
    providerMessageId: varchar("provider_message_id", { length: 256 }).notNull(),
    direction: varchar("direction", { length: 16 }).notNull(),
    messageType: varchar("message_type", { length: 32 }).notNull(),
    text: text("text"),
    providerTimestamp: timestamp("provider_timestamp", { withTimezone: true }).notNull(),
    fromMe: boolean("from_me").default(false).notNull(),
    processingStatus: varchar("processing_status", { length: 32 }).default("received").notNull(),
    ignoredReason: varchar("ignored_reason", { length: 64 }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.waAccountId],
      foreignColumns: [waAccounts.workspaceId, waAccounts.id],
      name: "messages_workspace_account_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.workspaceId, table.waAccountId, table.conversationId],
      foreignColumns: [conversations.workspaceId, conversations.waAccountId, conversations.id],
      name: "messages_workspace_conversation_fk",
    }).onDelete("cascade"),
    uniqueIndex("messages_workspace_account_provider_uidx").on(
      table.workspaceId,
      table.waAccountId,
      table.providerMessageId,
    ),
    uniqueIndex("messages_workspace_id_uidx").on(table.workspaceId, table.id),
    index("messages_workspace_conversation_timestamp_idx").on(
      table.workspaceId,
      table.conversationId,
      table.providerTimestamp,
      table.id,
    ),
  ],
);

export const messageMedia = pgTable(
  "message_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    fileName: varchar("file_name", { length: 255 }),
    fileSize: bigint("file_size", { mode: "number" }),
    storageKey: varchar("storage_key", { length: 512 }),
    processingStatus: varchar("processing_status", { length: 32 })
      .default("metadata_only")
      .notNull(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.messageId],
      foreignColumns: [messages.workspaceId, messages.id],
      name: "message_media_workspace_message_fk",
    }).onDelete("cascade"),
    uniqueIndex("message_media_workspace_message_uidx").on(table.workspaceId, table.messageId),
  ],
);

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    position: integer("position").notNull(),
    isTerminal: boolean("is_terminal").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("pipeline_stages_workspace_name_uidx").on(table.workspaceId, table.name),
    uniqueIndex("pipeline_stages_workspace_position_uidx").on(table.workspaceId, table.position),
  ],
);

export const systemSettings = pgTable(
  "system_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 100 }).notNull(),
    value: jsonb("value").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("system_settings_workspace_key_uidx").on(table.workspaceId, table.key)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (table) => [
    index("audit_logs_workspace_created_at_idx").on(table.workspaceId, table.createdAt),
    index("audit_logs_actor_idx").on(table.actorUserId),
  ],
);
