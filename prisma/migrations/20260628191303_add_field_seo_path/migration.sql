/*
  Warnings:

  - Added the required column `seoPath` to the `ads` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "seoPath" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "path" TEXT[] DEFAULT ARRAY[]::TEXT[];
