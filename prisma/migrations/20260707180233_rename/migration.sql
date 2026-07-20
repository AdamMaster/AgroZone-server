/*
  Warnings:

  - The values [text] on the enum `FeatureType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FeatureType_new" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT');
ALTER TABLE "category_features" ALTER COLUMN "type" TYPE "FeatureType_new" USING ("type"::text::"FeatureType_new");
ALTER TYPE "FeatureType" RENAME TO "FeatureType_old";
ALTER TYPE "FeatureType_new" RENAME TO "FeatureType";
DROP TYPE "public"."FeatureType_old";
COMMIT;
