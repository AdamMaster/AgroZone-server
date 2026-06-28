/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `ads` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ads_title_trgm";

-- DropIndex
DROP INDEX "categories_name_trgm";

-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "slug" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "ads_slug_key" ON "ads"("slug");
