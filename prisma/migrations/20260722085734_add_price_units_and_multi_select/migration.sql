-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('ITEM', 'TON', 'KG', 'LITER', 'M3', 'BAG', 'HEAD');

-- AlterEnum
ALTER TYPE "FeatureType" ADD VALUE 'MULTI_SELECT';

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "price_units" "PriceUnit"[] DEFAULT ARRAY['ITEM']::"PriceUnit"[];
