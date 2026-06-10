/*
  Warnings:

  - You are about to drop the column `latitude` on the `ads` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `ads` table. All the data in the column will be lost.
  - Added the required column `lat` to the `ads` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lng` to the `ads` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ads" DROP COLUMN "latitude",
DROP COLUMN "longitude",
ADD COLUMN     "lat" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "lng" DOUBLE PRECISION NOT NULL;
