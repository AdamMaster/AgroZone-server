-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "hidden_by_buyer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hidden_by_seller" BOOLEAN NOT NULL DEFAULT false;
