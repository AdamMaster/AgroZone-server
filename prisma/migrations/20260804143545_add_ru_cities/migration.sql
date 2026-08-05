-- CreateTable
CREATE TABLE "ru_cities" (
    "fias_id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "city_type" TEXT,
    "region" TEXT NOT NULL,
    "region_type" TEXT,
    "is_federal_city" BOOLEAN NOT NULL DEFAULT false,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ru_cities_pkey" PRIMARY KEY ("fias_id")
);

-- CreateIndex
CREATE INDEX "ru_cities_city_idx" ON "ru_cities"("city");
