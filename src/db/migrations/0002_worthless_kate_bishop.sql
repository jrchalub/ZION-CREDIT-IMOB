CREATE TYPE "public"."bank_transaction_direction" AS ENUM('CREDIT', 'DEBIT');--> statement-breakpoint
CREATE TYPE "public"."document_processing_run_status" AS ENUM('PENDING', 'QUEUED', 'PROCESSING', 'OCR_PROCESSING', 'CLASSIFYING', 'EXTRACTING', 'VALIDATING', 'COMPLETED', 'REQUIRES_REVIEW', 'FAILED');--> statement-breakpoint
CREATE TABLE "ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid,
	"processing_run_id" uuid,
	"provider" text NOT NULL,
	"model" text,
	"operation" text NOT NULL,
	"prompt_version" text,
	"request_hash" text,
	"status" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"estimated_cost" numeric(12, 6),
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ai_request_id" uuid NOT NULL,
	"status" text NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb,
	"raw_valid" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"processing_run_id" uuid,
	"holder_name" text,
	"holder_cpf_masked" text,
	"bank_name" text,
	"agency" text,
	"account_masked" text,
	"period_start" text,
	"period_end" text,
	"opening_balance" numeric(14, 2),
	"closing_balance" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_statement_id" uuid NOT NULL,
	"transaction_date" text,
	"description" text,
	"amount" numeric(14, 2),
	"direction" "bank_transaction_direction",
	"balance" numeric(14, 2),
	"category" text DEFAULT 'UNKNOWN' NOT NULL,
	"classification_confidence" numeric(5, 4),
	"evidence_page" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"processing_run_id" uuid,
	"suggested_type_code" text NOT NULL,
	"matched_document_type_id" uuid,
	"confidence" numeric(5, 4) NOT NULL,
	"decision" text NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"prompt_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_consistency_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"document_id" uuid,
	"processing_run_id" uuid,
	"consistency_score" integer,
	"issues" jsonb DEFAULT '[]'::jsonb,
	"factors" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_extracted_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"processing_run_id" uuid,
	"field" text NOT NULL,
	"value" text,
	"normalized_value" text,
	"confidence" numeric(5, 4),
	"page" integer,
	"evidence_text" text,
	"bounding_box" jsonb,
	"provider" text NOT NULL,
	"model" text,
	"prompt_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_field_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"extracted_field_id" uuid,
	"field" text NOT NULL,
	"ai_value" text,
	"corrected_value" text NOT NULL,
	"reason" text,
	"corrected_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_ocr_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"processing_run_id" uuid,
	"provider" text NOT NULL,
	"provider_version" text,
	"text" text NOT NULL,
	"pages" integer,
	"confidence" numeric(5, 4),
	"processing_time_ms" integer,
	"method" text DEFAULT 'ocr' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_processing_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"status" "document_processing_run_status" DEFAULT 'PENDING' NOT NULL,
	"correlation_id" text,
	"job_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "duplicate_of_document_id" uuid;--> statement-breakpoint
ALTER TABLE "pendencies" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_processing_run_id_document_processing_runs_id_fk" FOREIGN KEY ("processing_run_id") REFERENCES "public"."document_processing_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_responses" ADD CONSTRAINT "ai_responses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_responses" ADD CONSTRAINT "ai_responses_ai_request_id_ai_requests_id_fk" FOREIGN KEY ("ai_request_id") REFERENCES "public"."ai_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_processing_run_id_document_processing_runs_id_fk" FOREIGN KEY ("processing_run_id") REFERENCES "public"."document_processing_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_statement_id_bank_statements_id_fk" FOREIGN KEY ("bank_statement_id") REFERENCES "public"."bank_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_processing_run_id_document_processing_runs_id_fk" FOREIGN KEY ("processing_run_id") REFERENCES "public"."document_processing_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_matched_document_type_id_document_types_id_fk" FOREIGN KEY ("matched_document_type_id") REFERENCES "public"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_consistency_checks" ADD CONSTRAINT "document_consistency_checks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_consistency_checks" ADD CONSTRAINT "document_consistency_checks_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_consistency_checks" ADD CONSTRAINT "document_consistency_checks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_consistency_checks" ADD CONSTRAINT "document_consistency_checks_processing_run_id_document_processing_runs_id_fk" FOREIGN KEY ("processing_run_id") REFERENCES "public"."document_processing_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extracted_fields" ADD CONSTRAINT "document_extracted_fields_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extracted_fields" ADD CONSTRAINT "document_extracted_fields_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_extracted_fields" ADD CONSTRAINT "document_extracted_fields_processing_run_id_document_processing_runs_id_fk" FOREIGN KEY ("processing_run_id") REFERENCES "public"."document_processing_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_field_corrections" ADD CONSTRAINT "document_field_corrections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_field_corrections" ADD CONSTRAINT "document_field_corrections_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_field_corrections" ADD CONSTRAINT "document_field_corrections_extracted_field_id_document_extracted_fields_id_fk" FOREIGN KEY ("extracted_field_id") REFERENCES "public"."document_extracted_fields"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_field_corrections" ADD CONSTRAINT "document_field_corrections_corrected_by_user_id_users_id_fk" FOREIGN KEY ("corrected_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_ocr_results" ADD CONSTRAINT "document_ocr_results_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_ocr_results" ADD CONSTRAINT "document_ocr_results_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_ocr_results" ADD CONSTRAINT "document_ocr_results_processing_run_id_document_processing_runs_id_fk" FOREIGN KEY ("processing_run_id") REFERENCES "public"."document_processing_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_runs" ADD CONSTRAINT "document_processing_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_runs" ADD CONSTRAINT "document_processing_runs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_runs" ADD CONSTRAINT "document_processing_runs_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_requests_tenant_idx" ON "ai_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ai_requests_document_idx" ON "ai_requests" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "ai_responses_request_idx" ON "ai_responses" USING btree ("ai_request_id");--> statement-breakpoint
CREATE INDEX "bank_statements_document_idx" ON "bank_statements" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "bank_tx_statement_idx" ON "bank_transactions" USING btree ("bank_statement_id");--> statement-breakpoint
CREATE INDEX "doc_class_document_idx" ON "document_classifications" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "doc_consistency_process_idx" ON "document_consistency_checks" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "doc_consistency_document_idx" ON "document_consistency_checks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "doc_extracted_document_idx" ON "document_extracted_fields" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "doc_extracted_field_idx" ON "document_extracted_fields" USING btree ("document_id","field");--> statement-breakpoint
CREATE INDEX "doc_field_corr_document_idx" ON "document_field_corrections" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "doc_ocr_document_idx" ON "document_ocr_results" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "doc_ocr_run_idx" ON "document_ocr_results" USING btree ("processing_run_id");--> statement-breakpoint
CREATE INDEX "doc_proc_runs_document_idx" ON "document_processing_runs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "doc_proc_runs_tenant_idx" ON "document_processing_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "doc_proc_runs_status_idx" ON "document_processing_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_proc_runs_job_uidx" ON "document_processing_runs" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pendencies_idempotency_uidx" ON "pendencies" USING btree ("tenant_id","idempotency_key");