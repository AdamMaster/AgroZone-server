-- CreateEnum
CREATE TYPE "AdBumpStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'CANCELED');

-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "bumped_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ad_bumps" (
    "id" TEXT NOT NULL,
    "ad_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "AdBumpStatus" NOT NULL DEFAULT 'PENDING',
    "yookassa_payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "ad_bumps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ad_bumps_yookassa_payment_id_key" ON "ad_bumps"("yookassa_payment_id");

-- CreateIndex
CREATE INDEX "ad_bumps_ad_id_idx" ON "ad_bumps"("ad_id");

-- CreateIndex
CREATE INDEX "ad_bumps_user_id_idx" ON "ad_bumps"("user_id");

-- CreateIndex
CREATE INDEX "ad_bumps_status_idx" ON "ad_bumps"("status");

-- AddForeignKey
ALTER TABLE "ad_bumps" ADD CONSTRAINT "ad_bumps_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_bumps" ADD CONSTRAINT "ad_bumps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
