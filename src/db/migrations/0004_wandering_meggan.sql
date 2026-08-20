CREATE TABLE "financial_analysis_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"financial_analysis_id" uuid NOT NULL,
	"rule_version" text NOT NULL,
	"income_method_version" text NOT NULL,
	"payload" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_analyses" ADD COLUMN "rule_version" text DEFAULT 'rules-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_analysis_snapshots" ADD CONSTRAINT "financial_analysis_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_analysis_snapshots" ADD CONSTRAINT "financial_analysis_snapshots_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_analysis_snapshots" ADD CONSTRAINT "financial_analysis_snapshots_financial_analysis_id_financial_analyses_id_fk" FOREIGN KEY ("financial_analysis_id") REFERENCES "public"."financial_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fin_analysis_snapshots_analysis_uidx" ON "financial_analysis_snapshots" USING btree ("financial_analysis_id");--> statement-breakpoint
CREATE INDEX "fin_analysis_snapshots_process_idx" ON "financial_analysis_snapshots" USING btree ("process_id");