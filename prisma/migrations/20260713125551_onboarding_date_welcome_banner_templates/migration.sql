-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "onboardingDate" TIMESTAMP(3),
ADD COLUMN     "welcomeMessage" TEXT,
ADD COLUMN     "welcomeTitle" TEXT;

-- AlterTable
ALTER TABLE "OnboardingStep" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateOnboardingStep" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "dayLabel" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "clientActionable" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "TemplateOnboardingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateMetricConfig" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "metricKey" "MetricKey" NOT NULL,
    "cadence" "MetricCadence" NOT NULL DEFAULT 'PERPETUAL',
    "targetMin" DOUBLE PRECISION,
    "targetMax" DOUBLE PRECISION,
    "tips" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "TemplateMetricConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateMilestone" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "subLabel" TEXT,
    "targetValue" INTEGER,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "TemplateMilestone_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TemplateOnboardingStep" ADD CONSTRAINT "TemplateOnboardingStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateMetricConfig" ADD CONSTRAINT "TemplateMetricConfig_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateMilestone" ADD CONSTRAINT "TemplateMilestone_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
