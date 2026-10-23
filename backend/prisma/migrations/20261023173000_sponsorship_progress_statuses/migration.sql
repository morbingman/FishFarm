-- Persist the admin workflow stages so buyer and admin screens share one status.
ALTER TYPE "SponsorshipStatus" ADD VALUE IF NOT EXISTS 'preparing';
ALTER TYPE "SponsorshipStatus" ADD VALUE IF NOT EXISTS 'handover';
