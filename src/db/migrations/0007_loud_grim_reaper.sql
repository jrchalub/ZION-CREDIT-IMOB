ALTER TABLE "users" ADD COLUMN "correspondent_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_correspondent_id_correspondents_id_fk" FOREIGN KEY ("correspondent_id") REFERENCES "public"."correspondents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_correspondent_idx" ON "users" USING btree ("correspondent_id");