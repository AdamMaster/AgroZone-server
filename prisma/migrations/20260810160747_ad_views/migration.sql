-- CreateTable
CREATE TABLE "ad_views" (
    "id" TEXT NOT NULL,
    "ad_id" TEXT NOT NULL,
    "viewer_key" TEXT NOT NULL,
    "view_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_views_daily" (
    "id" TEXT NOT NULL,
    "ad_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ad_views_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_views_view_date_idx" ON "ad_views"("view_date");

-- CreateIndex
CREATE UNIQUE INDEX "ad_views_ad_id_viewer_key_view_date_key" ON "ad_views"("ad_id", "viewer_key", "view_date");

-- CreateIndex
CREATE UNIQUE INDEX "ad_views_daily_ad_id_date_key" ON "ad_views_daily"("ad_id", "date");

-- AddForeignKey
ALTER TABLE "ad_views" ADD CONSTRAINT "ad_views_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_views_daily" ADD CONSTRAINT "ad_views_daily_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
