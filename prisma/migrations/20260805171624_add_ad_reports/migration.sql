-- CreateEnum
CREATE TYPE "AdReportReason" AS ENUM ('SCAM', 'WRONG_CATEGORY', 'PROHIBITED_ITEM', 'DUPLICATE', 'SPAM', 'OTHER');

-- CreateTable
CREATE TABLE "ad_reports" (
    "id" TEXT NOT NULL,
    "ad_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" "AdReportReason" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_reports_ad_id_idx" ON "ad_reports"("ad_id");

-- CreateIndex
CREATE INDEX "ad_reports_user_id_idx" ON "ad_reports"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_reports_ad_id_user_id_key" ON "ad_reports"("ad_id", "user_id");

-- AddForeignKey
ALTER TABLE "ad_reports" ADD CONSTRAINT "ad_reports_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_reports" ADD CONSTRAINT "ad_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
