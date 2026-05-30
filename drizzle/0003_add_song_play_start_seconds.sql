ALTER TABLE "songs"
ADD COLUMN IF NOT EXISTS "play_start_seconds" integer NOT NULL DEFAULT 0;
