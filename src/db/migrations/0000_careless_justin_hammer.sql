CREATE TYPE "public"."amortization_system" AS ENUM('SAC', 'PRICE');--> statement-breakpoint
CREATE TYPE "public"."income_profile" AS ENUM('AUTONOMO', 'CLT', 'MEI', 'EMPRESARIO', 'SERVIDOR_PUBLICO', 'APOSENTADO', 'PENSIONISTA', 'COMPOSICAO_RENDA', 'SOCIO_EMPRESA', 'PRODUTOR_RURAL');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('SOLTEIRO', 'CASADO', 'DIVORCIADO', 'VIUVO', 'UNIAO_ESTAVEL', 'SEPARADO');--> statement-breakpoint
CREATE TYPE "public"."process_status" AS ENUM('NOVO', 'DOCUMENTACAO_PENDENTE', 'DOCUMENTACAO_RECEBIDA', 'EM_TRIAGEM', 'EM_ANALISE', 'PENDENCIA_ANALISTA', 'PRE_ANALISADO', 'APTO', 'NAO_APTO', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_BANCO', 'ENVIADO_AO_BANCO', 'APROVADO', 'REPROVADO', 'CONTRATADO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'GESTOR', 'ANALISTA', 'CORRESPONDENTE', 'OPERADOR', 'CLIENTE');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"ip" text,
	"user_agent" text,
	"correlation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"street" text NOT NULL,
	"number" text,
	"complement" text,
	"neighborhood" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip_code" text NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"cpf" text NOT NULL,
	"rg" text,
	"birth_date" date,
	"marital_status" "marital_status",
	"nationality" text DEFAULT 'Brasileira',
	"profession" text,
	"occupation_type" text,
	"activity_start_date" date,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"declared_income" numeric(14, 2),
	"fgts_balance" numeric(14, 2),
	"down_payment_available" numeric(14, 2),
	"primary_bank" text,
	"bank_account" text,
	"overdraft_limit" numeric(14, 2),
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "correspondents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"cnpj" text,
	"responsible_name" text,
	"phone" text,
	"email" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"developer" text,
	"builder" text,
	"street" text,
	"city" text,
	"state" text,
	"min_value" numeric(14, 2),
	"max_value" numeric(14, 2),
	"status" text DEFAULT 'ATIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financing_processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_number" text NOT NULL,
	"client_id" uuid NOT NULL,
	"income_profile" "income_profile" NOT NULL,
	"correspondent_id" uuid,
	"analyst_id" uuid,
	"development_id" uuid,
	"unit_id" uuid,
	"intended_bank" text,
	"property_value" numeric(14, 2),
	"down_payment" numeric(14, 2),
	"financed_amount" numeric(14, 2),
	"fgts_amount" numeric(14, 2),
	"amortization_system" "amortization_system",
	"financing_type" text,
	"status" "process_status" DEFAULT 'NOVO' NOT NULL,
	"internal_score" integer,
	"analyzed_income" numeric(14, 2),
	"payment_capacity" numeric(14, 2),
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_moved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_number_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"from_status" "process_status",
	"to_status" "process_status" NOT NULL,
	"reason" text,
	"changed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"document" text,
	"active" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"development_id" uuid NOT NULL,
	"block" text,
	"unit_number" text NOT NULL,
	"floor" integer,
	"area_m2" numeric(10, 2),
	"bedrooms" integer,
	"parking_spaces" integer,
	"value" numeric(14, 2),
	"status" text DEFAULT 'DISPONIVEL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_addresses" ADD CONSTRAINT "client_addresses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_addresses" ADD CONSTRAINT "client_addresses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correspondents" ADD CONSTRAINT "correspondents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developments" ADD CONSTRAINT "developments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_processes" ADD CONSTRAINT "financing_processes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_processes" ADD CONSTRAINT "financing_processes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_processes" ADD CONSTRAINT "financing_processes_correspondent_id_correspondents_id_fk" FOREIGN KEY ("correspondent_id") REFERENCES "public"."correspondents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_processes" ADD CONSTRAINT "financing_processes_analyst_id_users_id_fk" FOREIGN KEY ("analyst_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_processes" ADD CONSTRAINT "financing_processes_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_processes" ADD CONSTRAINT "financing_processes_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_processes" ADD CONSTRAINT "financing_processes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_number_sequences" ADD CONSTRAINT "process_number_sequences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_status_history" ADD CONSTRAINT "process_status_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_status_history" ADD CONSTRAINT "process_status_history_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_status_history" ADD CONSTRAINT "process_status_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_development_id_developments_id_fk" FOREIGN KEY ("development_id") REFERENCES "public"."developments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "client_addresses_client_idx" ON "client_addresses" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_addresses_tenant_idx" ON "client_addresses" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_tenant_cpf_uidx" ON "clients" USING btree ("tenant_id","cpf");--> statement-breakpoint
CREATE INDEX "clients_tenant_idx" ON "clients" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "clients_full_name_idx" ON "clients" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "correspondents_tenant_idx" ON "correspondents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "developments_tenant_idx" ON "developments" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "processes_tenant_number_uidx" ON "financing_processes" USING btree ("tenant_id","process_number");--> statement-breakpoint
CREATE INDEX "processes_tenant_idx" ON "financing_processes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "processes_status_idx" ON "financing_processes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "processes_client_idx" ON "financing_processes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "processes_analyst_idx" ON "financing_processes" USING btree ("analyst_id");--> statement-breakpoint
CREATE UNIQUE INDEX "process_sequences_tenant_year_uidx" ON "process_number_sequences" USING btree ("tenant_id","year");--> statement-breakpoint
CREATE INDEX "process_status_history_process_idx" ON "process_status_history" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "process_status_history_tenant_idx" ON "process_status_history" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "units_tenant_idx" ON "units" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "units_development_idx" ON "units" USING btree ("development_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_email_uidx" ON "users" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");