-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "categoryPath" TEXT[] DEFAULT ARRAY[]::TEXT[];
