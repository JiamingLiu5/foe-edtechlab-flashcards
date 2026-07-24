-- CreateEnum
CREATE TYPE "GenerationJobKind" AS ENUM ('import', 'review');

-- CreateEnum
CREATE TYPE "GenerationSourceType" AS ENUM ('pdf', 'url');

-- AlterTable
ALTER TABLE "generation_jobs"
  ADD COLUMN "kind" "GenerationJobKind" NOT NULL DEFAULT 'import',
  ADD COLUMN "sourceType" "GenerationSourceType" NOT NULL DEFAULT 'pdf',
  ADD COLUMN "sourceUrl" TEXT,
  ALTER COLUMN "uploadPath" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ai_drafts"
  ADD COLUMN "issue" TEXT,
  ADD COLUMN "originalCardId" TEXT;

-- CreateIndex
CREATE INDEX "ai_drafts_originalCardId_idx" ON "ai_drafts"("originalCardId");

-- AddForeignKey
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_originalCardId_fkey" FOREIGN KEY ("originalCardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
