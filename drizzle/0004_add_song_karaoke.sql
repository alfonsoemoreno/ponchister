ALTER TABLE "songs"
ADD COLUMN IF NOT EXISTS "karaoke" boolean NOT NULL DEFAULT false;

ALTER TABLE "songs"
ADD COLUMN IF NOT EXISTS "karaoke_pause_seconds" integer NOT NULL DEFAULT 0;

ALTER TABLE "songs"
ADD COLUMN IF NOT EXISTS "karaoke_lyric" text;
