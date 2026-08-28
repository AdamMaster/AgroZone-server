/*
  Warnings:

  - You are about to drop the column `embedding` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `embedding_updated_at` on the `categories` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "categories" DROP COLUMN "embedding",
DROP COLUMN "embedding_updated_at";

-- CreateTable
CREATE TABLE "category_terms" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_terms_category_id_idx" ON "category_terms"("category_id");

-- AddForeignKey
ALTER TABLE "category_terms" ADD CONSTRAINT "category_terms_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
