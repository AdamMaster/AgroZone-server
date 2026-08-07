-- CreateEnum
CREATE TYPE "PremiumPurchaseStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'CANCELED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "premium_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "premium_purchases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PremiumPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "yookassa_payment_id" TEXT,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "yookassa_payment_method_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "premium_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "premium_purchases_yookassa_payment_id_key" ON "premium_purchases"("yookassa_payment_id");

-- CreateIndex
CREATE INDEX "premium_purchases_user_id_idx" ON "premium_purchases"("user_id");

-- CreateIndex
CREATE INDEX "premium_purchases_status_idx" ON "premium_purchases"("status");

-- AddForeignKey
ALTER TABLE "premium_purchases" ADD CONSTRAINT "premium_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
