-- CreateEnum
CREATE TYPE "MetricStatus" AS ENUM ('ON_TRACK', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "MetricKey" AS ENUM ('EMAILS_SENT', 'POSITIVE_REPLIES', 'QUALIFIED_APPTS', 'POSITIVE_REPLY_RATE', 'EMAILS_PER_BOOKED', 'EMAILS_PER_QUALIFIED');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "audienceId" TEXT;

-- AlterTable
ALTER TABLE "OnboardingStep" ADD COLUMN     "clientActionable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PipelineEntry" ADD COLUMN     "audienceId" TEXT;

-- CreateTable
CREATE TABLE "Audience" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Audience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceDailyStat" (
    "id" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sends" INTEGER NOT NULL DEFAULT 0,
    "totalReplies" INTEGER NOT NULL DEFAULT 0,
    "positiveReplies" INTEGER NOT NULL DEFAULT 0,
    "bounces" INTEGER NOT NULL DEFAULT 0,
    "apptsBooked" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AudienceDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfrastructureItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "monthlyCost" INTEGER NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "InfrastructureItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricConfig" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "metricKey" "MetricKey" NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "status" "MetricStatus" NOT NULL,
    "tips" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "MetricConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AudienceDailyStat_audienceId_date_key" ON "AudienceDailyStat"("audienceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MetricConfig_clientId_metricKey_key" ON "MetricConfig"("clientId", "metricKey");

-- AddForeignKey
ALTER TABLE "Audience" ADD CONSTRAINT "Audience_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "Audience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceDailyStat" ADD CONSTRAINT "AudienceDailyStat_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "Audience"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineEntry" ADD CONSTRAINT "PipelineEntry_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "Audience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfrastructureItem" ADD CONSTRAINT "InfrastructureItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricConfig" ADD CONSTRAINT "MetricConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
