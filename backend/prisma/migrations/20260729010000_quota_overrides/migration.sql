-- CreateTable
CREATE TABLE "quota_overrides" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "dailyLimit" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quota_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quota_overrides_userId_bucket_key" ON "quota_overrides"("userId", "bucket");

-- AddForeignKey
ALTER TABLE "quota_overrides" ADD CONSTRAINT "quota_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
