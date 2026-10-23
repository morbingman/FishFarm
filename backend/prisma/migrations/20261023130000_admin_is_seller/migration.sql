-- FishFarm has two application roles. Existing Seller rows are promoted to Admin;
-- the enum value remains for backwards-compatible reads during rolling deploys.
UPDATE "User" SET "role" = 'Admin' WHERE "role" = 'Seller';
