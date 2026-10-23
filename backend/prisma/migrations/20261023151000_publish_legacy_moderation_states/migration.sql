-- Retire old moderation states without publishing previously rejected content.
-- Admin can inspect/edit these drafts and explicitly publish them in the new flow.
UPDATE "Listing"
SET
  "status" = 'draft',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" IN ('changes', 'rejected');
