ALTER TABLE "game_sessions"
ADD COLUMN IF NOT EXISTS "city" text,
ADD COLUMN IF NOT EXISTS "region" text,
ADD COLUMN IF NOT EXISTS "latitude" double precision,
ADD COLUMN IF NOT EXISTS "longitude" double precision;
