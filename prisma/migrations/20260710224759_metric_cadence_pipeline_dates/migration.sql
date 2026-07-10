-- CreateEnum
CREATE TYPE "MetricCadence" AS ENUM ('DAILY', 'WEEKLY', 'PERPETUAL');

-- AlterTable
ALTER TABLE "MetricConfig" DROP COLUMN "targetLabel",
ADD COLUMN     "cadence" "MetricCadence" NOT NULL DEFAULT 'PERPETUAL';

-- AlterTable
ALTER TABLE "PipelineEntry" ADD COLUMN     "closeDate" TIMESTAMP(3),
ADD COLUMN     "discoveryCallDate" TIMESTAMP(3),
ADD COLUMN     "positiveReplyDate" TIMESTAMP(3),
ADD COLUMN     "salesCallDate" TIMESTAMP(3);

