-- DropForeignKey
ALTER TABLE "magic_links" DROP CONSTRAINT "magic_links_userId_fkey";

-- DropTable
DROP TABLE "magic_links";

-- AddColumn
ALTER TABLE "users" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '';

-- AlterColumn
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP DEFAULT;
