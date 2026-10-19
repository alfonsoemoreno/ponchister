ALTER TABLE "game_sessions"
ADD COLUMN IF NOT EXISTS "country_code" text;

CREATE INDEX IF NOT EXISTS game_sessions_created_at_country_code_idx
ON "game_sessions" ("created_at", "country_code");
