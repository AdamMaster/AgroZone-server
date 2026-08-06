-- CreateEnum
CREATE TYPE "AdReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED');

-- AlterTable
ALTER TABLE "ad_reports" ADD COLUMN     "status" "AdReportStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "ad_reports_status_idx" ON "ad_reports"("status");
