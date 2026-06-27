/*
  Warnings:

  - You are about to drop the column `iconId` on the `categories` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "categories" DROP COLUMN "iconId",
ADD COLUMN     "icon_id" TEXT;
