ALTER TABLE "songs"
ADD COLUMN IF NOT EXISTS "trivia" boolean NOT NULL DEFAULT false;

ALTER TABLE "songs"
ADD COLUMN IF NOT EXISTS "trivia_question" text;

ALTER TABLE "songs"
ADD COLUMN IF NOT EXISTS "trivia_answer" text;
