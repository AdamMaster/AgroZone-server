-- CreateEnum
CREATE TYPE "AdBadge" AS ENUM ('URGENT', 'NEGOTIABLE', 'NEW');

-- CreateEnum
CREATE TYPE "AdServiceType" AS ENUM ('BUMP', 'PRICE_HIGHLIGHT', 'BADGE');

-- CreateEnum
CREATE TYPE "AdServicePurchaseStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'CANCELED');

-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "badge" "AdBadge",
ADD COLUMN     "badge_until" TIMESTAMP(3),
ADD COLUMN     "price_highlight_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ad_service_purchases" (
    "id" TEXT NOT NULL,
    "ad_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "services" "AdServiceType"[],
    "badge" "AdBadge",
    "status" "AdServicePurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "yookassa_payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "ad_service_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ad_service_purchases_yookassa_payment_id_key" ON "ad_service_purchases"("yookassa_payment_id");

-- CreateIndex
CREATE INDEX "ad_service_purchases_ad_id_idx" ON "ad_service_purchases"("ad_id");

-- CreateIndex
CREATE INDEX "ad_service_purchases_user_id_idx" ON "ad_service_purchases"("user_id");

-- CreateIndex
CREATE INDEX "ad_service_purchases_status_idx" ON "ad_service_purchases"("status");

-- AddForeignKey
ALTER TABLE "ad_service_purchases" ADD CONSTRAINT "ad_service_purchases_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_service_purchases" ADD CONSTRAINT "ad_service_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
