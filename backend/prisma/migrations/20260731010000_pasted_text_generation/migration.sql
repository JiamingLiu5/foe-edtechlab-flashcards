-- Allow imported study text to be retained and reused as a grounding source.
ALTER TYPE "GenerationSourceType" ADD VALUE 'text';

ALTER TABLE "generation_jobs" ADD COLUMN "sourceText" TEXT;
