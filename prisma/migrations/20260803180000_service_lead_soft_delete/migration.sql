-- Soft delete for leads. CallRail's cursor is inclusive, so a hard-deleted
-- lead would be recreated on the very next sync; a tombstone keeps it gone.
ALTER TABLE "ServiceLead" ADD COLUMN "deletedAt" TIMESTAMP(3);
