CREATE TYPE "public"."notification_channel" AS ENUM('EMAIL', 'WHATSAPP', 'SMS', 'PUSH', 'IN_APP');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('PENDING', 'QUEUED', 'SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid,
	"client_id" uuid,
	"event_type" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"status" "notification_status" DEFAULT 'PENDING' NOT NULL,
	"recipient" text,
	"subject" text,
	"body" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"provider" text,
	"provider_message_id" text,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_sla" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"documentation_started_at" timestamp with time zone,
	"documentation_completed_at" timestamp with time zone,
	"analysis_started_at" timestamp with time zone,
	"analysis_completed_at" timestamp with time zone,
	"dossier_ready_at" timestamp with time zone,
	"review_started_at" timestamp with time zone,
	"review_completed_at" timestamp with time zone,
	"sent_to_institution_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"documentation_ms" integer,
	"analysis_ms" integer,
	"review_ms" integer,
	"total_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_sla" ADD CONSTRAINT "process_sla_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_sla" ADD CONSTRAINT "process_sla_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_tenant_idx" ON "notifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notifications_process_idx" ON "notifications" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "notifications_event_idx" ON "notifications" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "process_sla_process_uidx" ON "process_sla" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "process_sla_tenant_idx" ON "process_sla" USING btree ("tenant_id");