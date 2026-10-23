-- A farming offer is one juvenile fish sponsored by one investor.
ALTER TABLE "GrowOutBatch"
ADD COLUMN "ageMonths" INTEGER,
ADD COLUMN "currentSizeCm" DOUBLE PRECISION,
ADD COLUMN "targetSizeCm" DOUBLE PRECISION,
ADD COLUMN "gender" TEXT,
ADD COLUMN "health" TEXT,
ADD COLUMN "carePlan" TEXT;
