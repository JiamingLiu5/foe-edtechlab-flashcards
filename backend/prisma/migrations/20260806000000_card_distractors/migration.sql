-- Cached AI-generated plausible-but-wrong MCQ options. Empty until the first
-- quiz generation computes and persists them; cleared whenever front/back edits
-- make the cached options stale.
ALTER TABLE "cards" ADD COLUMN "distractors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
