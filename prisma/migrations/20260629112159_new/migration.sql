/*
  Warnings:

  - A unique constraint covering the columns `[fullPath]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[parent_id,slug]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fullPath` to the `categories` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "categories_slug_key";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "fullPath" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "categories_fullPath_key" ON "categories"("fullPath");

-- CreateIndex
CREATE INDEX "categories_fullPath_idx" ON "categories"("fullPath");

-- CreateIndex
CREATE UNIQUE INDEX "categories_parent_id_slug_key" ON "categories"("parent_id", "slug");
