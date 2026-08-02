-- AlterTable
ALTER TABLE "LeadActivity" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "occurredAt" TIMESTAMP(3);
-- AlterTable
ALTER TABLE "ServiceLead" ADD COLUMN     "personId" TEXT,
ADD COLUMN     "phoneNormalized" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "LeadActivity_dedupeKey_key" ON "LeadActivity"("dedupeKey");
-- CreateIndex
CREATE INDEX "ServiceLead_clientId_phoneNormalized_idx" ON "ServiceLead"("clientId", "phoneNormalized");
-- CreateIndex
CREATE INDEX "ServiceLead_clientId_personId_idx" ON "ServiceLead"("clientId", "personId");
