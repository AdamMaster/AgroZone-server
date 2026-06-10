/*
  Warnings:

  - You are about to alter the column `price` on the `ads` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('FIXED', 'NEGOTIABLE');

-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "priceType" "PriceType" NOT NULL DEFAULT 'FIXED',
ALTER COLUMN "price" DROP NOT NULL,
ALTER COLUMN "price" SET DATA TYPE INTEGER;

-- CreateIndex
CREATE INDEX "ads_status_idx" ON "ads"("status");

-- CreateIndex
CREATE INDEX "ads_user_id_idx" ON "ads"("user_id");

-- CreateIndex
CREATE INDEX "ads_category_id_idx" ON "ads"("category_id");
