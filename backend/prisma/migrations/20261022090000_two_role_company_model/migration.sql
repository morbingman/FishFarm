-- Two-role company-operated model.
--
-- Buyer and Seller collapse into a single `User` role; the company that runs
-- FishFarm owns all commercial inventory, so listings, orders, reviews and
-- batches move from per-seller ownership to a single Company row. Existing
-- rows are backfilled instead of dropped.

-- ---------------------------------------------------------------------------
-- 1. Enums: Buyer/Seller -> User
-- ---------------------------------------------------------------------------

BEGIN;
CREATE TYPE "ActorRole_new" AS ENUM ('User', 'Admin', 'System');
ALTER TABLE "Activity" ALTER COLUMN "role" TYPE "ActorRole_new" USING (
  CASE WHEN "role"::text IN ('Buyer', 'Seller') THEN 'User' ELSE "role"::text END
)::"ActorRole_new";
ALTER TYPE "ActorRole" RENAME TO "ActorRole_old";
ALTER TYPE "ActorRole_new" RENAME TO "ActorRole";
DROP TYPE "public"."ActorRole_old";
COMMIT;

BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('User', 'Admin');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE WHEN "role"::text IN ('Buyer', 'Seller') THEN 'User' ELSE "role"::text END
)::"UserRole_new";
ALTER TABLE "Notification" ALTER COLUMN "recipientRole" TYPE "UserRole_new" USING (
  CASE
    WHEN "recipientRole" IS NULL THEN NULL
    WHEN "recipientRole"::text IN ('Buyer', 'Seller') THEN 'User'
    ELSE "recipientRole"::text
  END
)::"UserRole_new";
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'User';
COMMIT;

-- ---------------------------------------------------------------------------
-- 2. Company identity + facilities
-- ---------------------------------------------------------------------------

CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "about" TEXT NOT NULL DEFAULT '',
    "location" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- Every existing record belongs to the one company operating the platform.
INSERT INTO "Company" ("id", "name", "about", "updatedAt")
VALUES ('fishfarm', 'FishFarm', '', CURRENT_TIMESTAMP);

CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Facility" ("id", "companyId", "name", "location", "updatedAt")
VALUES ('fishfarm-main', 'fishfarm', 'Main grow-out facility', 'Long An', CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------------------
-- 3. Listings: seller-owned -> company-owned
-- ---------------------------------------------------------------------------

ALTER TABLE "Listing" DROP CONSTRAINT "Listing_ownerId_fkey";
DROP INDEX "Listing_ownerId_status_idx";

ALTER TABLE "Listing"
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "companyName" TEXT,
  ADD COLUMN "createdById" TEXT;

UPDATE "Listing"
SET "companyId" = 'fishfarm',
    "companyName" = COALESCE(NULLIF("sellerName", ''), 'FishFarm'),
    "createdById" = "ownerId";

ALTER TABLE "Listing"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "companyName" SET NOT NULL;

ALTER TABLE "Listing"
  DROP COLUMN "ownerId",
  DROP COLUMN "sellerName";

-- ---------------------------------------------------------------------------
-- 4. Orders, reviews, conversations: seller -> company counterparty
-- ---------------------------------------------------------------------------

ALTER TABLE "Order" DROP CONSTRAINT "Order_sellerId_fkey";
DROP INDEX "Order_sellerId_status_idx";
ALTER TABLE "Order" ADD COLUMN "companyId" TEXT;
UPDATE "Order" SET "companyId" = 'fishfarm';
ALTER TABLE "Order" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Order" DROP COLUMN "sellerId";

ALTER TABLE "Review" DROP CONSTRAINT "Review_sellerId_fkey";
DROP INDEX "Review_sellerId_createdAt_idx";
ALTER TABLE "Review" ADD COLUMN "companyId" TEXT;
UPDATE "Review" SET "companyId" = 'fishfarm';
ALTER TABLE "Review" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Review" DROP COLUMN "sellerId";

ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_sellerId_fkey";
DROP INDEX "Conversation_sellerId_lastMessageAt_idx";
ALTER TABLE "Conversation" ADD COLUMN "companyId" TEXT;
UPDATE "Conversation" SET "companyId" = 'fishfarm';
ALTER TABLE "Conversation" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Conversation" DROP COLUMN "sellerId";

-- ---------------------------------------------------------------------------
-- 5. Grow-out batches: seller + facility -> company + facility
-- ---------------------------------------------------------------------------

ALTER TABLE "GrowOutBatch" DROP CONSTRAINT "GrowOutBatch_sellerId_fkey";
DROP INDEX "GrowOutBatch_sellerId_status_idx";

ALTER TABLE "GrowOutBatch"
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "facilityId" TEXT;

UPDATE "GrowOutBatch"
SET "companyId" = 'fishfarm',
    "facilityId" = 'fishfarm-main';

ALTER TABLE "GrowOutBatch" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "GrowOutBatch" DROP COLUMN "sellerId";

-- ---------------------------------------------------------------------------
-- 6. Farm verification: seller -> facility
-- ---------------------------------------------------------------------------

ALTER TABLE "FarmVerification" DROP CONSTRAINT "FarmVerification_sellerId_fkey";
DROP INDEX "FarmVerification_sellerId_key";

ALTER TABLE "FarmVerification" ADD COLUMN "facilityId" TEXT;
UPDATE "FarmVerification" SET "facilityId" = 'fishfarm-main';
ALTER TABLE "FarmVerification" ALTER COLUMN "facilityId" SET NOT NULL;
ALTER TABLE "FarmVerification" DROP COLUMN "sellerId";

-- ---------------------------------------------------------------------------
-- 7. Users: company branding is not a per-account field
-- ---------------------------------------------------------------------------

ALTER TABLE "User" DROP COLUMN "store";

-- ---------------------------------------------------------------------------
-- 8. Indexes and foreign keys
-- ---------------------------------------------------------------------------

CREATE INDEX "Facility_companyId_idx" ON "Facility"("companyId");
CREATE INDEX "Conversation_companyId_lastMessageAt_idx" ON "Conversation"("companyId", "lastMessageAt");
CREATE UNIQUE INDEX "FarmVerification_facilityId_key" ON "FarmVerification"("facilityId");
CREATE INDEX "GrowOutBatch_companyId_status_idx" ON "GrowOutBatch"("companyId", "status");
CREATE INDEX "GrowOutBatch_facilityId_idx" ON "GrowOutBatch"("facilityId");
CREATE INDEX "Listing_companyId_status_idx" ON "Listing"("companyId", "status");
CREATE INDEX "Order_companyId_status_idx" ON "Order"("companyId", "status");
CREATE INDEX "Review_companyId_createdAt_idx" ON "Review"("companyId", "createdAt");

ALTER TABLE "Facility" ADD CONSTRAINT "Facility_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrowOutBatch" ADD CONSTRAINT "GrowOutBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GrowOutBatch" ADD CONSTRAINT "GrowOutBatch_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GrowOutBatch" ADD CONSTRAINT "GrowOutBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FarmVerification" ADD CONSTRAINT "FarmVerification_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
