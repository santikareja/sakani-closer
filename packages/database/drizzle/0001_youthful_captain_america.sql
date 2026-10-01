CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "status" varchar(32) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_workspace_id" uuid;--> statement-breakpoint
UPDATE "users"
SET "default_workspace_id" = existing_membership."workspace_id"
FROM (
	SELECT DISTINCT ON ("user_id") "user_id", "workspace_id"
	FROM "memberships"
	ORDER BY "user_id", "created_at" ASC
) AS existing_membership
WHERE "users"."id" = existing_membership."user_id"
	AND "users"."default_workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" varchar(512);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" varchar(32) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_workspace_token_uidx" ON "sessions" USING btree ("workspace_id","token_hash");--> statement-breakpoint
CREATE INDEX "sessions_workspace_user_idx" ON "sessions" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "sessions_workspace_expires_idx" ON "sessions" USING btree ("workspace_id","expires_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_workspace_id_workspaces_id_fk" FOREIGN KEY ("default_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_default_workspace_idx" ON "users" USING btree ("default_workspace_id");
