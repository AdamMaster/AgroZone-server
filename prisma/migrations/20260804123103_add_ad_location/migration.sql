-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "locality" TEXT,
ADD COLUMN     "locality_fias_id" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "region_iso_code" TEXT;

-- CreateIndex
CREATE INDEX "ads_region_iso_code_idx" ON "ads"("region_iso_code");

-- CreateIndex
CREATE INDEX "ads_locality_fias_id_idx" ON "ads"("locality_fias_id");
