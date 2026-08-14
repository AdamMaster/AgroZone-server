-- AlterTable
ALTER TABLE "users" ADD COLUMN     "business_inn" TEXT,
ADD COLUMN     "business_name" TEXT,
ADD COLUMN     "business_verified_at" TIMESTAMP(3);
