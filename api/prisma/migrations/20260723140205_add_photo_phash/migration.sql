-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "phash" VARCHAR(64);

-- CreateIndex
CREATE INDEX "photos_phash_idx" ON "photos"("phash");
