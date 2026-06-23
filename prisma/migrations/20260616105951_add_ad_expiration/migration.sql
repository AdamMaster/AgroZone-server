/*
  Warnings:

  - Made the column `user_id` on table `ads` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "AdStatus" ADD VALUE 'EXPIRED';

-- DropIndex
DROP INDEX "ads_expires_at_idx";

-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "published_at" TIMESTAMP(3),
ALTER COLUMN "user_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ads_status_expires_at_idx" ON "ads"("status", "expires_at");
