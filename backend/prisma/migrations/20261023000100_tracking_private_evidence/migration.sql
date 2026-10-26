ALTER TABLE "DisputeAttachment" ADD COLUMN "uploadId" TEXT;
ALTER TABLE "GrowOutBatch" ADD COLUMN "shareQuantity" INTEGER;
ALTER TABLE "Order" ADD COLUMN "estimatedDeliveryAt" TIMESTAMP(3), ADD COLUMN "shippedAt" TIMESTAMP(3), ADD COLUMN "trackingCarrier" TEXT, ADD COLUMN "trackingNumber" TEXT;
ALTER TABLE "VerificationDocument" ADD COLUMN "uploadId" TEXT;
CREATE UNIQUE INDEX "DisputeAttachment_uploadId_key" ON "DisputeAttachment"("uploadId");
CREATE UNIQUE INDEX "VerificationDocument_uploadId_key" ON "VerificationDocument"("uploadId");
ALTER TABLE "DisputeAttachment" ADD CONSTRAINT "DisputeAttachment_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
