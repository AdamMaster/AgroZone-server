/*
  Warnings:

  - The `unit` column on the `ads` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PriceUnit" ADD VALUE 'DOSE';
ALTER TYPE "PriceUnit" ADD VALUE 'RUNNING_METER';
ALTER TYPE "PriceUnit" ADD VALUE 'HA';
ALTER TYPE "PriceUnit" ADD VALUE 'HOUR';

-- AlterTable
ALTER TABLE "ads" ALTER COLUMN "price" SET DATA TYPE BIGINT,
DROP COLUMN "unit",
ADD COLUMN     "unit" "PriceUnit" NOT NULL DEFAULT 'ITEM';

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "category_features" ADD COLUMN     "description" TEXT;
