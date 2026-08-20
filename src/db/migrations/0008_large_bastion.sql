CREATE TABLE "portal_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"label" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "portal_access_tokens_hash_uidx" ON "portal_access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "portal_access_tokens_tenant_idx" ON "portal_access_tokens" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "portal_access_tokens_process_idx" ON "portal_access_tokens" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "portal_access_tokens_expires_idx" ON "portal_access_tokens" USING btree ("expires_at");