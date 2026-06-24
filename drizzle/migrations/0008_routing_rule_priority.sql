ALTER TABLE "routing_rules" ADD COLUMN "priority" integer;
--> statement-breakpoint
UPDATE "routing_rules" rr
SET "priority" = sub.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC, id ASC) AS row_num
  FROM "routing_rules"
) sub
WHERE rr.id = sub.id;
--> statement-breakpoint
ALTER TABLE "routing_rules" ALTER COLUMN "priority" SET NOT NULL;
