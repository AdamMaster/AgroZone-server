-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "archived_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ads_status_archived_at_idx" ON "ads"("status", "archived_at");
