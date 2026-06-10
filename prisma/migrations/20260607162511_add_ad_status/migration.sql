-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED');

-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "status" "AdStatus" NOT NULL DEFAULT 'PENDING';
