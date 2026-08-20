-- FASE 6.4 — self-service pendency lifecycle
CREATE TYPE "public"."pendency_status_v2" AS ENUM('OPEN', 'SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
ALTER TABLE "pendencies" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "pendencies" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pendencies" ADD COLUMN "reviewed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "pendencies" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "pendencies" ADD COLUMN "status_v2" "pendency_status_v2";--> statement-breakpoint
UPDATE "pendencies" SET "title" = COALESCE(NULLIF(trim("type"), ''), 'Pendência') WHERE "title" IS NULL;--> statement-breakpoint
ALTER TABLE "pendencies" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
UPDATE "pendencies" SET "status_v2" = CASE "status"::text
  WHEN 'ABERTA' THEN 'OPEN'::pendency_status_v2
  WHEN 'EM_ANDAMENTO' THEN 'SUBMITTED'::pendency_status_v2
  WHEN 'RESOLVIDA' THEN 'RESOLVED'::pendency_status_v2
  WHEN 'CANCELADA' THEN 'CANCELLED'::pendency_status_v2
  ELSE 'OPEN'::pendency_status_v2
END;--> statement-breakpoint
ALTER TABLE "pendencies" ALTER COLUMN "status_v2" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pendencies" ALTER COLUMN "status_v2" SET DEFAULT 'OPEN'::pendency_status_v2;--> statement-breakpoint
ALTER TABLE "pendencies" DROP COLUMN "status";--> statement-breakpoint
DROP TYPE "public"."pendency_status";--> statement-breakpoint
ALTER TYPE "public"."pendency_status_v2" RENAME TO "pendency_status";--> statement-breakpoint
ALTER TABLE "pendencies" RENAME COLUMN "status_v2" TO "status";--> statement-breakpoint
ALTER TABLE "pendencies" ADD CONSTRAINT "pendencies_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
