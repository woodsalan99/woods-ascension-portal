-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('COLD_EMAIL', 'LOCAL_SERVICES');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('LSA', 'GBP_CALL', 'WEBSITE_FORM', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'QUOTE_SENT', 'JOB_SCHEDULED', 'JOB_WON', 'REVIEW_REQUESTED', 'REVIEW_COMPLETE', 'LOST');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "type" "ClientType" NOT NULL DEFAULT 'COLD_EMAIL';

-- AlterTable
ALTER TABLE "SyncRun" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'SMARTLEAD';

-- CreateTable
CREATE TABLE "ClientIntegration" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "credentials" BYTEA NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceLead" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "location" TEXT,
    "address" TEXT,
    "serviceType" TEXT,
    "message" TEXT,
    "qualified" BOOLEAN,
    "needsDetails" BOOLEAN NOT NULL DEFAULT false,
    "jobValue" INTEGER,
    "callRecordId" TEXT,
    "formSubmissionId" TEXT,
    "gmailMessageId" TEXT,
    "callRailUrl" TEXT,
    "recordingUrl" TEXT,
    "nextActionLabel" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadNote" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "callRailId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "callerNumber" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "keypress" TEXT,
    "classification" TEXT NOT NULL,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "forwarded" BOOLEAN NOT NULL,
    "recordingUrl" TEXT,
    "raw" JSONB NOT NULL,

    CONSTRAINT "CallRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "message" TEXT,
    "spamVerdict" BOOLEAN,
    "spamConfidence" DOUBLE PRECISION,
    "spamReason" TEXT,
    "passedOn" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB NOT NULL,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LsaMonthlyStat" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL,
    "topRatePct" DOUBLE PRECISION NOT NULL,
    "absTopRatePct" DOUBLE PRECISION NOT NULL,
    "spendCents" INTEGER NOT NULL,
    "chargedLeads" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LsaMonthlyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GscDailyStat" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,

    CONSTRAINT "GscDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "town" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "indexed" BOOLEAN NOT NULL DEFAULT false,
    "indexedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientLocation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClientLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeogridScan" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "gridJson" JSONB NOT NULL,
    "avgRank" DOUBLE PRECISION NOT NULL,
    "top3Pct" DOUBLE PRECISION NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeogridScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordRank" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "volume" INTEGER,
    "position" INTEGER NOT NULL,
    "prevPosition" INTEGER,
    "url" TEXT NOT NULL,

    CONSTRAINT "KeywordRank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewSnapshot" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ReviewSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "leadId" TEXT,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "jobFinishedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "remindAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientTask" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "responseType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "sortOrder" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ClientTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskSubmission" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "textValue" TEXT,
    "fileUrl" TEXT,
    "submittedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "TaskSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ADMIN_NOTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyWork" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "heroTitleAuto" TEXT,
    "heroSubAuto" TEXT,
    "heroTitleManual" TEXT,
    "heroSubManual" TEXT,
    "items" JSONB NOT NULL,
    "noteFromAlan" TEXT,
    "nextMonth" JSONB NOT NULL,

    CONSTRAINT "MonthlyWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalContent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricOverride" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "originalValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationChannel" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "userId" TEXT,
    "channel" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientIntegration_clientId_provider_key" ON "ClientIntegration"("clientId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLead_callRecordId_key" ON "ServiceLead"("callRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLead_formSubmissionId_key" ON "ServiceLead"("formSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceLead_gmailMessageId_key" ON "ServiceLead"("gmailMessageId");

-- CreateIndex
CREATE INDEX "ServiceLead_clientId_stage_idx" ON "ServiceLead"("clientId", "stage");

-- CreateIndex
CREATE INDEX "ServiceLead_clientId_receivedAt_idx" ON "ServiceLead"("clientId", "receivedAt");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CallRecord_callRailId_key" ON "CallRecord"("callRailId");

-- CreateIndex
CREATE INDEX "CallRecord_clientId_occurredAt_idx" ON "CallRecord"("clientId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "FormSubmission_gmailMessageId_key" ON "FormSubmission"("gmailMessageId");

-- CreateIndex
CREATE INDEX "FormSubmission_clientId_receivedAt_idx" ON "FormSubmission"("clientId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LsaMonthlyStat_clientId_month_key" ON "LsaMonthlyStat"("clientId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "GscDailyStat_clientId_date_key" ON "GscDailyStat"("clientId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SitePage_clientId_url_key" ON "SitePage"("clientId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "GeogridScan_clientId_locationId_keyword_month_key" ON "GeogridScan"("clientId", "locationId", "keyword", "month");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordRank_clientId_month_keyword_key" ON "KeywordRank"("clientId", "month", "keyword");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewSnapshot_clientId_date_key" ON "ReviewSnapshot"("clientId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewItem_clientId_author_reviewedAt_key" ON "ReviewItem"("clientId", "author", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyWork_clientId_month_key" ON "MonthlyWork"("clientId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PortalContent_clientId_key_key" ON "PortalContent"("clientId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "MetricOverride_clientId_scopeKey_key" ON "MetricOverride"("clientId", "scopeKey");

-- CreateIndex
CREATE INDEX "Notification_clientId_kind_createdAt_idx" ON "Notification"("clientId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "ClientIntegration" ADD CONSTRAINT "ClientIntegration_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLead" ADD CONSTRAINT "ServiceLead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLead" ADD CONSTRAINT "ServiceLead_callRecordId_fkey" FOREIGN KEY ("callRecordId") REFERENCES "CallRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceLead" ADD CONSTRAINT "ServiceLead_formSubmissionId_fkey" FOREIGN KEY ("formSubmissionId") REFERENCES "FormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "ServiceLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "ServiceLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LsaMonthlyStat" ADD CONSTRAINT "LsaMonthlyStat_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GscDailyStat" ADD CONSTRAINT "GscDailyStat_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePage" ADD CONSTRAINT "SitePage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientLocation" ADD CONSTRAINT "ClientLocation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeogridScan" ADD CONSTRAINT "GeogridScan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeogridScan" ADD CONSTRAINT "GeogridScan_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "ClientLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordRank" ADD CONSTRAINT "KeywordRank_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSnapshot" ADD CONSTRAINT "ReviewSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "ServiceLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTask" ADD CONSTRAINT "ClientTask_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ClientTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyWork" ADD CONSTRAINT "MonthlyWork_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalContent" ADD CONSTRAINT "PortalContent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricOverride" ADD CONSTRAINT "MetricOverride_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationChannel" ADD CONSTRAINT "NotificationChannel_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
