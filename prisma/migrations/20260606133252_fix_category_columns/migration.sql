/*
  Warnings:

  - You are about to alter the column `price` on the `ads` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.

*/
-- AlterTable
ALTER TABLE "ads" ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "available_features" JSONB;
