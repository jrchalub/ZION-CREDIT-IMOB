CREATE TYPE "institutional_channel" AS ENUM ('NENHUM', 'CAIXA', 'OUTRO');
--> statement-breakpoint
ALTER TABLE "financing_processes" ADD COLUMN "institutional_channel" "institutional_channel" DEFAULT 'NENHUM' NOT NULL;
--> statement-breakpoint
ALTER TABLE "financing_processes" ADD COLUMN "institutional_send_opt_in" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TYPE "financing_institution" ADD VALUE IF NOT EXISTS 'OUTRO';
