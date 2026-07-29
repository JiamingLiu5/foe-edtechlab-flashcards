-- Retains each deck's imported PDF/URL source material (previously deleted once
-- drafts were resolved) so later AI review can fact-check cards against it.

-- CreateTable
CREATE TABLE "deck_sources" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "sourceType" "GenerationSourceType" NOT NULL,
    "label" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "storedPath" TEXT,
    "extractedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deck_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deck_sources_deckId_idx" ON "deck_sources"("deckId");

-- AddForeignKey
ALTER TABLE "deck_sources" ADD CONSTRAINT "deck_sources_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
