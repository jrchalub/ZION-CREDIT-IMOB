CREATE TYPE "public"."integration_kind" AS ENUM('BUREAU', 'BANK_READ');--> statement-breakpoint
CREATE TYPE "public"."integration_call_status" AS ENUM('QUEUED', 'SUCCEEDED', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TABLE "integration_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"client_id" uuid,
	"kind" "integration_kind" NOT NULL,
	"provider" text NOT NULL,
	"status" "integration_call_status" DEFAULT 'QUEUED' NOT NULL,
	"request_summary" jsonb DEFAULT '{}'::jsonb,
	"response_summary" jsonb DEFAULT '{}'::jsonb,
	"provider_ref" text,
	"error_message" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_calls" ADD CONSTRAINT "integration_calls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_calls" ADD CONSTRAINT "integration_calls_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_calls" ADD CONSTRAINT "integration_calls_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_calls" ADD CONSTRAINT "integration_calls_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_calls_tenant_idx" ON "integration_calls" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "integration_calls_process_idx" ON "integration_calls" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "integration_calls_kind_idx" ON "integration_calls" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "integration_calls_created_idx" ON "integration_calls" USING btree ("created_at");
