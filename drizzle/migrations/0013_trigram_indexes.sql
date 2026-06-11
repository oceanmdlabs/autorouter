CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_erequests_patient_name_trgm ON erequests USING GIN (patient_name gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_erequests_referring_provider_trgm ON erequests USING GIN (referring_provider gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_erequests_receiving_provider_trgm ON erequests USING GIN (receiving_provider gin_trgm_ops);
