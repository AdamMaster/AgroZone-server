/*
  Warnings:

  - You are about to drop the column `available_features` on the `categories` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "FeatureType" AS ENUM ('text', 'NUMBER', 'BOOLEAN', 'SELECT');

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "available_features";

-- CreateTable
CREATE TABLE "category_features" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FeatureType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "filterable" BOOLEAN NOT NULL DEFAULT true,
    "placeholder" TEXT,
    "unit" TEXT,
    "options" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_features_categoryId_idx" ON "category_features"("categoryId");

-- CreateIndex
CREATE INDEX "category_features_categoryId_sortOrder_idx" ON "category_features"("categoryId", "sortOrder");

-- AddForeignKey
ALTER TABLE "category_features" ADD CONSTRAINT "category_features_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
