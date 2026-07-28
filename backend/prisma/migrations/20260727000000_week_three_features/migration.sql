ALTER TABLE "cards" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "reviews" ADD COLUMN "repetitions" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "reviews_userId_cardId_reviewedAt_idx"
  ON "reviews"("userId", "cardId", "reviewedAt" DESC);
