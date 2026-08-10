-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_ad_id_fkey";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "ad_title_snapshot" TEXT,
ALTER COLUMN "ad_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
