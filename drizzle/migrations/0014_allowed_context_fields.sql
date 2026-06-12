ALTER TABLE "routing_rules" ADD COLUMN "allowed_context_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;
