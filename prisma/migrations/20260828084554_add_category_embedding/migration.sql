-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
ADD COLUMN     "embedding_updated_at" TIMESTAMP(3);
