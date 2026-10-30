-- Sponsorship disputes (§11): reuse the marketplace dispute flow (§3.8).
-- Additive only; existing order disputes keep working unchanged.
ALTER TABLE "Dispute" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "Dispute" ADD COLUMN "sponsorshipId" TEXT;
CREATE UNIQUE INDEX "Dispute_sponsorshipId_key" ON "Dispute"("sponsorshipId");
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_sponsorshipId_fkey" FOREIGN KEY ("sponsorshipId") REFERENCES "Sponsorship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
