/*
  Warnings:

  - Added the required column `phone` to the `ads` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "phone" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ads_phone_idx" ON "ads"("phone");
