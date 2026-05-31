CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS songs_song_attributes_gin
ON "songs"
USING gin ("song_attributes");

CREATE INDEX IF NOT EXISTS songs_public_approved_playable_year_id_idx
ON "songs" ("year", "id")
WHERE "scope" = 'public'
  AND "catalog_status" = 'approved'
  AND ("youtube_status" IS NULL OR "youtube_status" = 'operational');

CREATE INDEX IF NOT EXISTS songs_personal_owner_artist_title_idx
ON "songs" ("owner_user_id", "artist", "title")
WHERE "scope" = 'personal';

CREATE INDEX IF NOT EXISTS songs_artist_trgm_idx
ON "songs"
USING gin ("artist" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS songs_title_trgm_idx
ON "songs"
USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS songs_youtube_url_trgm_idx
ON "songs"
USING gin ("youtube_url" gin_trgm_ops);
