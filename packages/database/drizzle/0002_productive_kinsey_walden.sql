CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"wa_account_id" uuid NOT NULL,
	"wa_jid_hash" varchar(64) NOT NULL,
	"display_name" varchar(120),
	"phone_masked" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"wa_account_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"last_message_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"file_name" varchar(255),
	"file_size" bigint,
	"storage_key" varchar(512),
	"processing_status" varchar(32) DEFAULT 'metadata_only' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"wa_account_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"provider_message_id" varchar(256) NOT NULL,
	"direction" varchar(16) NOT NULL,
	"message_type" varchar(32) NOT NULL,
	"text" text,
	"provider_timestamp" timestamp with time zone NOT NULL,
	"from_me" boolean DEFAULT false NOT NULL,
	"processing_status" varchar(32) DEFAULT 'received' NOT NULL,
	"ignored_reason" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"gateway_account_id" varchar(64) NOT NULL,
	"label" varchar(120) NOT NULL,
	"account_identifier_masked" varchar(32),
	"status" varchar(32) DEFAULT 'disconnected' NOT NULL,
	"last_connected_at" timestamp with time zone,
	"last_disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "wa_accounts_workspace_id_uidx" ON "wa_accounts" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_workspace_id_uidx" ON "contacts" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_workspace_account_id_uidx" ON "conversations" USING btree ("workspace_id","wa_account_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_workspace_id_uidx" ON "messages" USING btree ("workspace_id","id");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspace_account_fk" FOREIGN KEY ("workspace_id","wa_account_id") REFERENCES "public"."wa_accounts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_account_fk" FOREIGN KEY ("workspace_id","wa_account_id") REFERENCES "public"."wa_accounts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_contact_fk" FOREIGN KEY ("workspace_id","contact_id") REFERENCES "public"."contacts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_media" ADD CONSTRAINT "message_media_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_media" ADD CONSTRAINT "message_media_workspace_message_fk" FOREIGN KEY ("workspace_id","message_id") REFERENCES "public"."messages"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_account_fk" FOREIGN KEY ("workspace_id","wa_account_id") REFERENCES "public"."wa_accounts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_conversation_fk" FOREIGN KEY ("workspace_id","wa_account_id","conversation_id") REFERENCES "public"."conversations"("workspace_id","wa_account_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_accounts" ADD CONSTRAINT "wa_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_workspace_account_jid_uidx" ON "contacts" USING btree ("workspace_id","wa_account_id","wa_jid_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_workspace_account_contact_uidx" ON "conversations" USING btree ("workspace_id","wa_account_id","contact_id");--> statement-breakpoint
CREATE INDEX "conversations_workspace_last_message_idx" ON "conversations" USING btree ("workspace_id","last_message_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_media_workspace_message_uidx" ON "message_media" USING btree ("workspace_id","message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_workspace_account_provider_uidx" ON "messages" USING btree ("workspace_id","wa_account_id","provider_message_id");--> statement-breakpoint
CREATE INDEX "messages_workspace_conversation_timestamp_idx" ON "messages" USING btree ("workspace_id","conversation_id","provider_timestamp","id");--> statement-breakpoint
CREATE UNIQUE INDEX "wa_accounts_workspace_gateway_uidx" ON "wa_accounts" USING btree ("workspace_id","gateway_account_id");--> statement-breakpoint
CREATE INDEX "wa_accounts_workspace_status_idx" ON "wa_accounts" USING btree ("workspace_id","status");
