/*
  Warnings:

  - Made the column `code` on table `categories` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `categories` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `categories` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "code" SET NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL;
