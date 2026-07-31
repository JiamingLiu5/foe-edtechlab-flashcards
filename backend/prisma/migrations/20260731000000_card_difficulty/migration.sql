-- Existing and manually-authored cards use a neutral default. AI generation
-- and review subsequently assign a level that can balance future quizzes.
CREATE TYPE "CardDifficulty" AS ENUM ('easy', 'medium', 'hard');

ALTER TABLE "cards"
  ADD COLUMN "difficulty" "CardDifficulty" NOT NULL DEFAULT 'medium';

ALTER TABLE "ai_drafts"
  ADD COLUMN "difficulty" "CardDifficulty" NOT NULL DEFAULT 'medium';
