/*
  Warnings:

  - You are about to drop the column `priceType` on the `ads` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ads" DROP COLUMN "priceType",
ADD COLUMN     "expires_at" TIMESTAMP(3);

-- DropEnum
DROP TYPE "PriceType";

-- CreateIndex
CREATE INDEX "ads_expires_at_idx" ON "ads"("expires_at");
