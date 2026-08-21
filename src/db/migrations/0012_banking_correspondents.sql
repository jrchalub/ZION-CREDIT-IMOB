CREATE TYPE "public"."banking_correspondent_status" AS ENUM('ATIVO', 'INATIVO');--> statement-breakpoint
CREATE TABLE "banking_correspondents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"document" text,
	"status" "banking_correspondent_status" DEFAULT 'ATIVO' NOT NULL,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commercial_banking_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"correspondent_id" uuid NOT NULL,
	"banking_correspondent_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financing_submission_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"external_status" text,
	"note" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financing_submissions" ADD COLUMN "banking_correspondent_id" uuid;--> statement-breakpoint
ALTER TABLE "banking_correspondents" ADD CONSTRAINT "banking_correspondents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_banking_access" ADD CONSTRAINT "commercial_banking_access_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_banking_access" ADD CONSTRAINT "commercial_banking_access_correspondent_id_correspondents_id_fk" FOREIGN KEY ("correspondent_id") REFERENCES "public"."correspondents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_banking_access" ADD CONSTRAINT "commercial_banking_access_banking_correspondent_id_banking_correspondents_id_fk" FOREIGN KEY ("banking_correspondent_id") REFERENCES "public"."banking_correspondents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_submission_events" ADD CONSTRAINT "financing_submission_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_submission_events" ADD CONSTRAINT "financing_submission_events_submission_id_financing_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."financing_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_submission_events" ADD CONSTRAINT "financing_submission_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financing_submissions" ADD CONSTRAINT "financing_submissions_banking_correspondent_id_banking_correspondents_id_fk" FOREIGN KEY ("banking_correspondent_id") REFERENCES "public"."banking_correspondents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "banking_correspondents_tenant_idx" ON "banking_correspondents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "banking_correspondents_status_idx" ON "banking_correspondents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commercial_banking_access_tenant_idx" ON "commercial_banking_access" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commercial_banking_access_org_idx" ON "commercial_banking_access" USING btree ("correspondent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_banking_access_uidx" ON "commercial_banking_access" USING btree ("tenant_id","correspondent_id","banking_correspondent_id");--> statement-breakpoint
CREATE INDEX "financing_submission_events_tenant_idx" ON "financing_submission_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "financing_submission_events_submission_idx" ON "financing_submission_events" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "financing_submissions_banking_corr_idx" ON "financing_submissions" USING btree ("banking_correspondent_id");
