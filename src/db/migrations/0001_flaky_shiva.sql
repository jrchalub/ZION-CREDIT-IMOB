CREATE TYPE "public"."checklist_item_status" AS ENUM('PENDENTE', 'ENVIADO', 'VALIDADO', 'REJEITADO', 'NAO_APLICAVEL');--> statement-breakpoint
CREATE TYPE "public"."checklist_requirement" AS ENUM('OBRIGATORIO', 'CONDICIONAL', 'OPCIONAL');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('PENDENTE', 'RECEBIDO', 'PROCESSANDO', 'VALIDADO', 'REJEITADO', 'EXPIRADO');--> statement-breakpoint
CREATE TYPE "public"."pendency_priority" AS ENUM('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');--> statement-breakpoint
CREATE TYPE "public"."pendency_status" AS ENUM('ABERTA', 'EM_ANDAMENTO', 'RESOLVIDA', 'CANCELADA');--> statement-breakpoint
CREATE TABLE "document_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'GERAL' NOT NULL,
	"allows_multiple" boolean DEFAULT false NOT NULL,
	"requires_competence" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"checklist_item_id" uuid,
	"original_filename" text NOT NULL,
	"internal_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"extension" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"content_hash" text NOT NULL,
	"storage_provider" text DEFAULT 'minio' NOT NULL,
	"storage_key" text NOT NULL,
	"status" "document_status" DEFAULT 'RECEBIDO' NOT NULL,
	"page_count" integer,
	"document_date" date,
	"competence" text,
	"valid_until" date,
	"classification_confidence" numeric(5, 4),
	"extraction_confidence" numeric(5, 4),
	"rejection_reason" text,
	"validated_by_user_id" uuid,
	"validated_at" timestamp with time zone,
	"uploaded_by_user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_profile_document_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"income_profile" "income_profile" NOT NULL,
	"document_type_id" uuid NOT NULL,
	"requirement" "checklist_requirement" DEFAULT 'OBRIGATORIO' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"label_template" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"condition_key" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pendencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"document_id" uuid,
	"checklist_item_id" uuid,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"priority" "pendency_priority" DEFAULT 'MEDIA' NOT NULL,
	"status" "pendency_status" DEFAULT 'ABERTA' NOT NULL,
	"assignee_user_id" uuid,
	"due_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "process_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"process_id" uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"label" text NOT NULL,
	"requirement" "checklist_requirement" NOT NULL,
	"status" "checklist_item_status" DEFAULT 'PENDENTE' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"competence" text,
	"condition_key" text,
	"document_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_validated_by_user_id_users_id_fk" FOREIGN KEY ("validated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_profile_document_requirements" ADD CONSTRAINT "income_profile_document_requirements_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencies" ADD CONSTRAINT "pendencies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencies" ADD CONSTRAINT "pendencies_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencies" ADD CONSTRAINT "pendencies_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencies" ADD CONSTRAINT "pendencies_checklist_item_id_process_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."process_checklist_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencies" ADD CONSTRAINT "pendencies_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencies" ADD CONSTRAINT "pendencies_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_checklist_items" ADD CONSTRAINT "process_checklist_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_checklist_items" ADD CONSTRAINT "process_checklist_items_process_id_financing_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."financing_processes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_checklist_items" ADD CONSTRAINT "process_checklist_items_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "process_checklist_items" ADD CONSTRAINT "process_checklist_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_tenant_idx" ON "documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "documents_process_idx" ON "documents" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "documents_client_idx" ON "documents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "documents_hash_idx" ON "documents" USING btree ("tenant_id","content_hash");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "profile_doc_req_profile_idx" ON "income_profile_document_requirements" USING btree ("income_profile");--> statement-breakpoint
CREATE INDEX "pendencies_tenant_idx" ON "pendencies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pendencies_process_idx" ON "pendencies" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "pendencies_status_idx" ON "pendencies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "checklist_process_idx" ON "process_checklist_items" USING btree ("process_id");--> statement-breakpoint
CREATE INDEX "checklist_tenant_idx" ON "process_checklist_items" USING btree ("tenant_id");