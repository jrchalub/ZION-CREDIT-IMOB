CREATE TYPE "public"."analyst_review_status" AS ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED');--> statement-breakpoint
CREATE TYPE "public"."decision_factor_kind" AS ENUM('POSITIVO', 'ATENCAO', 'PENDENCIA');--> statement-breakpoint
CREATE TYPE "public"."decision_factor_severity" AS ENUM('INFO', 'OK', 'ATENCAO', 'CRITICO');--> statement-breakpoint
CREATE TYPE "public"."decision_support_indicative" AS ENUM('FAVORAVEL', 'REQUER_ANALISE', 'DESFAVORAVEL');--> statement-breakpoint
CREATE TYPE "public"."matrix_result" AS ENUM('OK', 'ATENCAO', 'CRITICO', 'NA');--> statement-breakpoint
CREATE TABLE "credit_analyst_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"decision_support_snapshot_id" uuid NOT NULL,
	"financial_snapshot_id" uuid,
	"status" "analyst_review_status" DEFAULT 'PENDING' NOT NULL,
	"analyst_id" uuid,
	"decision" text,
	"justification" text,
	"started_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"decision_support_snapshot_id" uuid NOT NULL,
	"kind" "decision_factor_kind" NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"severity" "decision_factor_severity" DEFAULT 'INFO' NOT NULL,
	"category" text NOT NULL,
	"origin_type" text NOT NULL,
	"origin_id" text,
	"origin_label" text,
	"evidence" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_support_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"financial_snapshot_id" uuid,
	"version" text DEFAULT 'credit-support-v1' NOT NULL,
	"rules_version" text DEFAULT 'credit-support-v1' NOT NULL,
	"indicative_result" "decision_support_indicative" NOT NULL,
	"content_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"matrix" jsonb DEFAULT '[]'::jsonb,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_analyst_reviews" ADD CONSTRAINT "credit_analyst_reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analyst_reviews" ADD CONSTRAINT "credit_analyst_reviews_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analyst_reviews" ADD CONSTRAINT "credit_analyst_reviews_decision_support_snapshot_id_decision_support_snapshots_id_fk" FOREIGN KEY ("decision_support_snapshot_id") REFERENCES "public"."decision_support_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analyst_reviews" ADD CONSTRAINT "credit_analyst_reviews_financial_snapshot_id_financial_analysis_snapshots_id_fk" FOREIGN KEY ("financial_snapshot_id") REFERENCES "public"."financial_analysis_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analyst_reviews" ADD CONSTRAINT "credit_analyst_reviews_analyst_id_users_id_fk" FOREIGN KEY ("analyst_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_factors" ADD CONSTRAINT "decision_factors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_factors" ADD CONSTRAINT "decision_factors_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_factors" ADD CONSTRAINT "decision_factors_decision_support_snapshot_id_decision_support_snapshots_id_fk" FOREIGN KEY ("decision_support_snapshot_id") REFERENCES "public"."decision_support_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_support_snapshots" ADD CONSTRAINT "decision_support_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_support_snapshots" ADD CONSTRAINT "decision_support_snapshots_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_support_snapshots" ADD CONSTRAINT "decision_support_snapshots_financial_snapshot_id_financial_analysis_snapshots_id_fk" FOREIGN KEY ("financial_snapshot_id") REFERENCES "public"."financial_analysis_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_support_snapshots" ADD CONSTRAINT "decision_support_snapshots_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_analyst_reviews_process_idx" ON "credit_analyst_reviews" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "credit_analyst_reviews_status_idx" ON "credit_analyst_reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "credit_analyst_reviews_snapshot_idx" ON "credit_analyst_reviews" USING btree ("decision_support_snapshot_id");--> statement-breakpoint
CREATE INDEX "decision_factors_snapshot_idx" ON "decision_factors" USING btree ("decision_support_snapshot_id");--> statement-breakpoint
CREATE INDEX "decision_factors_process_idx" ON "decision_factors" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "decision_factors_code_idx" ON "decision_factors" USING btree ("code");--> statement-breakpoint
CREATE INDEX "decision_support_snapshots_process_idx" ON "decision_support_snapshots" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "decision_support_snapshots_tenant_idx" ON "decision_support_snapshots" USING btree ("tenant_id");