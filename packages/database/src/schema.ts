import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
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
