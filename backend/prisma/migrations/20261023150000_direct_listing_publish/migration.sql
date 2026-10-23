-- Moderation is no longer part of the listing workflow. Publish every listing
-- that was waiting in the old queue so it immediately appears in the marketplace.
UPDATE "Listing"
SET "status" = 'approved', "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'pending';
