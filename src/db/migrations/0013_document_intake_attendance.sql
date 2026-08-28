CREATE TABLE "process_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"external_conversation_id" text,
	"last_interaction_at" timestamp with time zone,
	"next_visit_at" timestamp with time zone,
	"next_visit_location" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "process_attendance" ADD CONSTRAINT "process_attendance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_attendance" ADD CONSTRAINT "process_attendance_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "process_attendance_process_uidx" ON "process_attendance" USING btree ("tenant_id","process_id");--> statement-breakpoint
CREATE INDEX "process_attendance_tenant_idx" ON "process_attendance" USING btree ("tenant_id");
