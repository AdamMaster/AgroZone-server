/*
  Warnings:

  - Made the column `location` on table `ads` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ads" ALTER COLUMN "location" SET NOT NULL;
