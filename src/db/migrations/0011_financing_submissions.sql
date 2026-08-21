CREATE TYPE "public"."financing_institution" AS ENUM('CAIXA');--> statement-breakpoint
CREATE TYPE "public"."financing_submission_status" AS ENUM('QUEUED', 'SUBMITTED', 'TRACKING', 'SUCCEEDED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "financing_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"institution" "financing_institution" DEFAULT 'CAIXA' NOT NULL,
	"provider" text NOT NULL,
	"status" "financing_submission_status" DEFAULT 'QUEUED' NOT NULL,
	"provider_ref" text,
	"external_status" text,
	"request_summary" jsonb DEFAULT '{}'::jsonb,
	"response_summary" jsonb DEFAULT '{}'::jsonb,
	"error_message" text,
	"submitted_by_user_id" uuid,
	"submitted_at" timestamp with time zone,
	"last_tracked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financing_submissions" ADD CONSTRAINT "financing_submissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_submissions" ADD CONSTRAINT "financing_submissions_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_submissions" ADD CONSTRAINT "financing_submissions_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "financing_submissions_tenant_idx" ON "financing_submissions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "financing_submissions_process_idx" ON "financing_submissions" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "financing_submissions_institution_idx" ON "financing_submissions" USING btree ("institution");--> statement-breakpoint
CREATE INDEX "financing_submissions_created_idx" ON "financing_submissions" USING btree ("created_at");
