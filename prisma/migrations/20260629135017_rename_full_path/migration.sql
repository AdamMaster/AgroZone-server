/*
  Warnings:

  - You are about to drop the column `fullPath` on the `categories` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[full_path]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `full_path` to the `categories` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "categories_fullPath_idx";

-- DropIndex
DROP INDEX "categories_fullPath_key";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "fullPath",
ADD COLUMN     "full_path" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "categories_full_path_key" ON "categories"("full_path");

-- CreateIndex
CREATE INDEX "categories_full_path_idx" ON "categories"("full_path");
