/*
  Warnings:

  - You are about to drop the column `categoryPath` on the `ads` table. All the data in the column will be lost.
  - You are about to drop the column `seoPath` on the `ads` table. All the data in the column will be lost.
  - Added the required column `seo_path` to the `ads` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ads" DROP COLUMN "categoryPath",
DROP COLUMN "seoPath",
ADD COLUMN     "category_path" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "seo_path" TEXT NOT NULL;
