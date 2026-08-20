CREATE TYPE "public"."financial_analysis_status" AS ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."financial_indicative" AS ENUM('FAVORAVEL', 'NECESSITA_ANALISE', 'DESFAVORAVEL');--> statement-breakpoint
CREATE TYPE "public"."transaction_category" AS ENUM('INCOME_PROBABLE', 'SALARY', 'OWN_TRANSFER', 'LOAN', 'REFUND', 'CARD_PAYMENT', 'EXPENSE', 'FEE', 'UNKNOWN');--> statement-breakpoint
CREATE TABLE "credit_card_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"financial_analysis_id" uuid NOT NULL,
	"document_id" uuid,
	"issuer" text,
	"credit_limit" numeric(14, 2),
	"available_limit" numeric(14, 2),
	"invoice_amount" numeric(14, 2),
	"installments_total" numeric(14, 2),
	"monthly_commitment" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"financial_analysis_id" uuid,
	"type" text NOT NULL,
	"creditor" text,
	"description" text,
	"outstanding_balance" numeric(14, 2),
	"monthly_installment" numeric(14, 2),
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"status" "financial_analysis_status" DEFAULT 'PENDING' NOT NULL,
	"method_version" text DEFAULT 'income-v1' NOT NULL,
	"indicative" "financial_indicative",
	"disclaimer" text NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb,
	"error_message" text,
	"correlation_id" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"financial_analysis_id" uuid NOT NULL,
	"rent" numeric(14, 2) DEFAULT '0' NOT NULL,
	"debts_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cards_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"other_commitments" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_commitments" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financing_simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"financial_analysis_id" uuid,
	"property_value" numeric(14, 2) NOT NULL,
	"down_payment" numeric(14, 2) NOT NULL,
	"fgts_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"financed_amount" numeric(14, 2) NOT NULL,
	"term_months" integer NOT NULL,
	"annual_rate_pct" numeric(8, 4) NOT NULL,
	"amortization_system" "amortization_system" NOT NULL,
	"first_installment" numeric(14, 2),
	"last_installment" numeric(14, 2),
	"average_installment" numeric(14, 2),
	"total_interest" numeric(14, 2),
	"schedule_summary" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"financial_analysis_id" uuid NOT NULL,
	"declared_income" numeric(14, 2),
	"estimated_income" numeric(14, 2),
	"mean_income" numeric(14, 2),
	"median_income" numeric(14, 2),
	"min_income" numeric(14, 2),
	"max_income" numeric(14, 2),
	"variation_pct" numeric(8, 4),
	"recurrence_score" numeric(5, 4),
	"confidence" numeric(5, 4),
	"months_analyzed" integer DEFAULT 0 NOT NULL,
	"method_version" text DEFAULT 'income-v1' NOT NULL,
	"exclusions" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_month_rolls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"financial_analysis_id" uuid NOT NULL,
	"bank_statement_id" uuid,
	"year_month" text NOT NULL,
	"period_start" text,
	"period_end" text,
	"gross_credits" numeric(14, 2) NOT NULL,
	"own_transfers" numeric(14, 2) DEFAULT '0' NOT NULL,
	"loans" numeric(14, 2) DEFAULT '0' NOT NULL,
	"refunds" numeric(14, 2) DEFAULT '0' NOT NULL,
	"other_exclusions" numeric(14, 2) DEFAULT '0' NOT NULL,
	"valid_credits" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_capacity_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"financial_analysis_id" uuid NOT NULL,
	"analyzed_income" numeric(14, 2),
	"total_commitments" numeric(14, 2),
	"simulated_installment" numeric(14, 2),
	"estimated_capacity" numeric(14, 2),
	"commitment_pct" numeric(8, 4),
	"indicative" "financial_indicative" NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_transaction_id" uuid NOT NULL,
	"category" "transaction_category" NOT NULL,
	"confidence" numeric(5, 4),
	"source" text DEFAULT 'rules-v1' NOT NULL,
	"rule_id" text,
	"overridden" boolean DEFAULT false NOT NULL,
	"previous_category" text,
	"overridden_by_user_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_card_analyses" ADD CONSTRAINT "credit_card_analyses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_analyses" ADD CONSTRAINT "credit_card_analyses_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_analyses" ADD CONSTRAINT "credit_card_analyses_financial_analysis_id_financial_analyses_id_fk" FOREIGN KEY ("financial_analysis_id") REFERENCES "public"."financial_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_analyses" ADD CONSTRAINT "credit_card_analyses_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_financial_analysis_id_financial_analyses_id_fk" FOREIGN KEY ("financial_analysis_id") REFERENCES "public"."financial_analyses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_analyses" ADD CONSTRAINT "financial_analyses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_analyses" ADD CONSTRAINT "financial_analyses_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_analyses" ADD CONSTRAINT "financial_analyses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_commitments" ADD CONSTRAINT "financial_commitments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_commitments" ADD CONSTRAINT "financial_commitments_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_commitments" ADD CONSTRAINT "financial_commitments_financial_analysis_id_financial_analyses_id_fk" FOREIGN KEY ("financial_analysis_id") REFERENCES "public"."financial_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_simulations" ADD CONSTRAINT "financing_simulations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_simulations" ADD CONSTRAINT "financing_simulations_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_simulations" ADD CONSTRAINT "financing_simulations_financial_analysis_id_financial_analyses_id_fk" FOREIGN KEY ("financial_analysis_id") REFERENCES "public"."financial_analyses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_analyses" ADD CONSTRAINT "income_analyses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_analyses" ADD CONSTRAINT "income_analyses_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_analyses" ADD CONSTRAINT "income_analyses_financial_analysis_id_financial_analyses_id_fk" FOREIGN KEY ("financial_analysis_id") REFERENCES "public"."financial_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_month_rolls" ADD CONSTRAINT "income_month_rolls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_month_rolls" ADD CONSTRAINT "income_month_rolls_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_month_rolls" ADD CONSTRAINT "income_month_rolls_financial_analysis_id_financial_analyses_id_fk" FOREIGN KEY ("financial_analysis_id") REFERENCES "public"."financial_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_month_rolls" ADD CONSTRAINT "income_month_rolls_bank_statement_id_bank_statements_id_fk" FOREIGN KEY ("bank_statement_id") REFERENCES "public"."bank_statements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_capacity_snapshots" ADD CONSTRAINT "payment_capacity_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_capacity_snapshots" ADD CONSTRAINT "payment_capacity_snapshots_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_capacity_snapshots" ADD CONSTRAINT "payment_capacity_snapshots_financial_analysis_id_financial_analyses_id_fk" FOREIGN KEY ("financial_analysis_id") REFERENCES "public"."financial_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_classifications" ADD CONSTRAINT "transaction_classifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_classifications" ADD CONSTRAINT "transaction_classifications_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_classifications" ADD CONSTRAINT "transaction_classifications_overridden_by_user_id_users_id_fk" FOREIGN KEY ("overridden_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_card_analyses_fin_idx" ON "credit_card_analyses" USING btree ("financial_analysis_id");--> statement-breakpoint
CREATE INDEX "debts_process_idx" ON "debts" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "fin_analyses_process_idx" ON "financial_analyses" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "fin_analyses_tenant_idx" ON "financial_analyses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "fin_commitments_fin_idx" ON "financial_commitments" USING btree ("financial_analysis_id");--> statement-breakpoint
CREATE INDEX "fin_simulations_process_idx" ON "financing_simulations" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "income_analyses_process_idx" ON "income_analyses" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "income_analyses_fin_idx" ON "income_analyses" USING btree ("financial_analysis_id");--> statement-breakpoint
CREATE INDEX "income_month_rolls_fin_idx" ON "income_month_rolls" USING btree ("financial_analysis_id");--> statement-breakpoint
CREATE INDEX "income_month_rolls_process_idx" ON "income_month_rolls" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "pay_capacity_fin_idx" ON "payment_capacity_snapshots" USING btree ("financial_analysis_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tx_class_tx_uidx" ON "transaction_classifications" USING btree ("bank_transaction_id");--> statement-breakpoint
CREATE INDEX "tx_class_tenant_idx" ON "transaction_classifications" USING btree ("tenant_id");