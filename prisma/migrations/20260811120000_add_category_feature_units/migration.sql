-- AlterTable
ALTER TABLE "category_features" ADD COLUMN     "units" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
